// SPDX-License-Identifier: GPL-3.0-only
/**
 * erodeMountain — one frame-gated step of the mountain erosion: walk a tile-column write cursor
 * down the mountain (stamping the fill tile) as it visibly eats away.
 *
 * Runs every frame from the main loop but does real work only occasionally, behind two gates: it
 * stays dormant until the round's frame counter PLAY_PHASE_COUNTER has climbed past 10, and then
 * acts only on the frame its step timer MOUNTAIN_ERODE_TIMER counts down to its last tick. When
 * both gates open it advances the animation by one cell:
 *   1. Patches the cells above the write cursor MOUNTAIN_ERODE_PTR: a marker tile one row up is
 *      rewritten and a second marker stamped a further row up; anything else is cleared to empty.
 *   2. Reads the tile AT the cursor: an empty / solid-edge tile extends the fill column downward;
 *      the wall tile either extends the fill if the cells below are still open, or drops a cap and
 *      clears the cursor, or shifts the three-cell horizontal window one place left — then reseeds
 *      through seedMountainErosion; any other tile is bumped up one animation frame, then reseeds.
 *   3. Extending the fill stamps the fill tile and steps the cursor down one row, stopping past the
 *      bottom tilemap row. On the trigger cell it finalises the spawn: unless a spawn is already
 *      past its first phase it re-tops the actor ENEMY3_Y (and its twin ENEMY3_TWIN_Y), marks
 *      BOARD_END_PHASE reached, and cues a sound. The tile-code bytes are opaque graphics indices.
 */
import {
  PLAY_PHASE_COUNTER,
  BOARD_END_PHASE,
  ENEMY3_Y,
  ENEMY3_TWIN_Y,
  MOUNTAIN_ERODE_TIMER,
  MOUNTAIN_ERODE_PTR,
} from "./names.js";
import { requestSound15 } from "./requestSound15.js";
import { requestSound7 } from "./requestSound7.js";
import { seedMountainErosion } from "./seedMountainErosion.js";

const ROW = 32; // one tilemap row is 32 columns apart

export function erodeMountain(m) {
  const { mem8, mem16 } = m;

  // Gate 1: dormant until the round's frame counter has climbed past 10.
  if (mem8[PLAY_PHASE_COUNTER] < 10) return;

  // Gate 2: run only on the frame the step timer hits its final count; else decrement and wait.
  const timer = mem8[MOUNTAIN_ERODE_TIMER];
  if (timer !== 1) {
    mem8[MOUNTAIN_ERODE_TIMER] = timer - 1;
    return;
  }

  // A step runs this frame: cue the step sound and take the current write cursor.
  requestSound15(m);
  const cursor = mem16[MOUNTAIN_ERODE_PTR];

  // 1. Patch the cell one row above the cursor (and, for the marker case, two rows above).
  if (mem8[cursor - ROW] === 0xae) {
    mem8[cursor - ROW] = 0xfe;
    mem8[cursor - 2 * ROW] = 0xfd;
  } else {
    mem8[cursor - ROW] = 0x24;
  }

  // 2. Classify the tile at the cursor and react.
  const tile = mem8[cursor];
  if (tile === 0x24 || tile === 0x33 || tile === 0x32) {
    return extendFillColumn();
  }
  if (tile === 0x30) {
    // Wall tile. Only act on the column below once the cell to the left is already empty.
    if (mem8[cursor - 1] === 0x24) {
      // If either cell below is still open, keep extending the fill down the column.
      if (mem8[cursor + ROW] === 0x24) return extendFillColumn();
      if (mem8[cursor + 2 * ROW] === 0x24) return extendFillColumn();
      // Column is closed below: cap the cell below and clear the cursor, then reseed.
      mem8[cursor + ROW] = 0x2d;
      mem8[cursor] = 0x24;
      return seedMountainErosion(m);
    }
    // Left cell not yet empty: shift the three-cell window one place left, opening the
    // far slot, then reseed the next window.
    mem8[cursor] = mem8[cursor - 1];
    mem8[cursor - 1] = mem8[cursor - 2];
    mem8[cursor - 2] = 0x24;
    return seedMountainErosion(m);
  }
  // Any other tile: advance it one animation frame, then reseed the next window.
  mem8[cursor] = tile + 1;
  return seedMountainErosion(m);

  // 3. Extend the fill column one cell — shared by the five classify outcomes above.
  function extendFillColumn() {
    let ptr = mem16[MOUNTAIN_ERODE_PTR];
    // Stop once the cursor has stepped past the bottom tilemap row.
    if (ptr >= 0x9400) return;
    // Stamp the fill tile, then step the cursor down one row and store it.
    mem8[ptr] = 0x31;
    ptr = (ptr + ROW) & 0xffff;
    mem16[MOUNTAIN_ERODE_PTR] = ptr;
    // Only the trigger cell finalises the spawn; every other cell waits for the next frame.
    if (ptr !== 0x92a4) return;

    // Trigger cell reached: finalise the spawn phase.
    const phase = mem8[BOARD_END_PHASE];
    if (phase !== 0) {
      if (phase >= 2) return; // already past the first phase — nothing to do
      // Phase 1: re-top the actor and its twin mirror, but only once it has sunk far enough.
      if (mem8[ENEMY3_Y] < 23) return;
      mem8[ENEMY3_Y] = 22;
      mem8[ENEMY3_TWIN_Y] = 22;
    }
    mem8[BOARD_END_PHASE] = 2; // mark the spawn phase reached
    return requestSound7(m); // cue the finalise sound
  }
}
