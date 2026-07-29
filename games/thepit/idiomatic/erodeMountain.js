// SPDX-License-Identifier: GPL-3.0-only
/**
 * erodeMountain — one frame-gated step of the mountain erosion: walk a tile-column write pointer
 * down the mountain (writing tile 0x31) as it visibly eats away.  ROM 0x241c. (§2.6)
 *
 * Runs every frame from the main loop but does real work only occasionally, behind two
 * gates: it stays dormant until the round's frame counter has climbed past 10, and then
 * acts only on the frame its own step timer counts down to its last tick. When both gates
 * open it advances the animation by a single cell:
 *
 *   1. Patches the cells directly above the write cursor: a 0xae marker one row up is
 *      rewritten to 0xfe with 0xfd stamped a further row up; anything else is cleared to
 *      the empty tile 0x24.
 *   2. Reads the tile AT the cursor and reacts to it:
 *        - an empty / solid-edge tile (0x24, 0x33, 0x32) extends the fill column downward
 *          (see step 3).
 *        - the wall tile 0x30: if the cells below are still open it extends the fill;
 *          otherwise it either drops a 0x2d cap and clears the cursor, or shifts the
 *          three-cell horizontal window one place to the left — then reseeds the next
 *          window through seedMountainErosion.
 *        - any other tile is bumped up one animation frame, then reseeds through seedMountainErosion.
 *   3. Extending the fill stamps tile 0x31 at the cursor and steps the cursor down one row,
 *      stopping once it passes the bottom tilemap row. When the cursor lands on the trigger
 *      cell it finalises the spawn: unless a spawn is already past its first phase it
 *      re-tops the actor (and its twin mirror), marks the spawn phase reached, and cues a
 *      sound.
 *
 * This is the mountain erosion (§2.6, grounded): each open frame walks the write cursor down
 * the mountain column stamping tile 0x31, the mountain visibly eating away, until it is gone —
 * which in the ESCAPE case forces the rescue ship down and advances the level. The tile-code and
 * marker bytes (0x24 / 0x30 / 0x31 / 0x2d / 0xae / 0xfe / 0xfd / 0x33 / 0x32) are opaque
 * graphics-ROM indices, kept hex like the other marker bytes in this layer; the tilemap addresses
 * (the 0x9400 bottom-row boundary, the 0x92a4 trigger cell) stay hex too. The write cursor is
 * MOUNTAIN_ERODE_PTR and the step timer MOUNTAIN_ERODE_TIMER (both from ram.js).
 *
 * Memory-equivalent to the frozen oracle — equivalence-241c.test.js.
 * GATE:     real captured dispatches (attract dispatches it ~2400× / 3000 frames — both
 *           early-exit gates plus the 0x24/0x33 fill, 0x2c-0x2f bump and 0x30 wall arms)
 *           + crafted entries for the arms attract never reaches (the 0xae fix-up, the 0x32
 *           tile, the loc_247a below-cell sub-arms, and the trigger-cell spawn finalise
 *           swept over spawn phase and actor height). RAM compared outside the dead stack
 *           scratch the oracle's call/enqueue parks just below the entry stack pointer,
 *           plus pc + SP. Teeth catch a dropped timer store and a corrupted finalise.
 * LIVE-OUT: memory-only — the step timer (MOUNTAIN_ERODE_TIMER), the write cursor
 *           (MOUNTAIN_ERODE_PTR), the patched
 *           tilemap cells, the spawn phase (BOARD_END_PHASE), the actor height (ENEMY3_Y /
 *           ENEMY3_TWIN_Y) and the sound ring on the finalise arm. The oracle's exit registers,
 *           flags and Z80 return path are dead scratch a plain JS call replaces.
 * NAMES:    PLAY_PHASE_COUNTER, BOARD_END_PHASE, ENEMY3_Y, ENEMY3_TWIN_Y, MOUNTAIN_ERODE_TIMER (the step
 *           timer) and MOUNTAIN_ERODE_PTR (the write cursor) from ram.js. Delegates the sound cues to
 *           requestSound15 / requestSound7 and the window reseed to seedMountainErosion.
 */
import {
  PLAY_PHASE_COUNTER,
  BOARD_END_PHASE,
  ENEMY3_Y,
  ENEMY3_TWIN_Y,
  MOUNTAIN_ERODE_TIMER,
  MOUNTAIN_ERODE_PTR,
} from "./ram.js";
import { requestSound15 } from "./requestSound15.js";
import { requestSound7 } from "./requestSound7.js";
import { seedMountainErosion } from "./seedMountainErosion.js";

const ROW = 32; // one tilemap row is 32 columns apart

export function erodeMountain(m) {
  const { mem8, mem16 } = m;

  // Gate 1: dormant until the round's frame counter has climbed past 10.
  if (mem8[PLAY_PHASE_COUNTER] < 10) return;

  // Gate 2: only the frame the step timer reaches its final count runs the step;
  // otherwise store the decremented timer and wait for the next frame.
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
