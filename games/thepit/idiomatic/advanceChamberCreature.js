// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceChamberCreature — per-frame driver for the left-chamber creature's sprite: bounce it
 * sideways within a fixed band, accelerate its own fall-Y until it hits the floor and RNG-resets,
 * cycle its sprite frame, publish its screen-relative sprite record, and — once the goal-zone latch
 * is set — dissolve one more column of the sliding-floor reveal into view. This drives the live
 * chamber creature; its canonical identity is a guess, but its mechanism is grounded. Every frame,
 * in order:
 *   1. Sliding-floor reveal (only once the goal-zone latch is set): a per-frame countdown lets one
 *      6-tile column through at a time, stepping a cursor back through a pattern table and stamping
 *      the tiles up a fixed video column; once the cursor runs off the start the reveal is done. As
 *      the player rests on the goal row this stage also cues the reveal sound once.
 *   2. Frame clock: a phase countdown flips the creature's tile between its two codes when it
 *      expires; otherwise the creature only moves every fourth frame (off-beat frames just republish).
 *   3. Position: horizontal bounce reverses velocity at each wall; the fall-Y accelerates until the
 *      floor, where it clamps, draws a fresh random step, and advances colour (priority bit clear).
 *   4. Publish: write the four sprite bytes (X/Y made screen-relative by the cabinet bias, plus tile
 *      and colour) into the staging slot, then hand off to the object-record pass, whose return is ours.
 */

import { requestSound11 } from "./requestSound11.js";
import { advanceRandom } from "./advanceRandom.js";
import { updateEnemy1 } from "./updateEnemy1.js";
import { u8 } from "../../../core/int.js";
import {
  GOAL_TILE_LATCH,
  PIT_CROSS_ACTIVE,
  PLAYER_X,
  PIT_FLOOR_REVEAL_GATE,
  PIT_FLOOR_REVEAL_PERIOD,
  PIT_FLOOR_REVEAL_CURSOR,
  CHAMBER_CREATURE_ANIM_PHASE,
  CHAMBER_CREATURE_X,
  CHAMBER_CREATURE_FRAME,
  CHAMBER_CREATURE_ATTR,
  CHAMBER_CREATURE_FALL_Y,
  SPRITE_COORD_BIAS,
  CHAMBER_CREATURE_X_VELOCITY,
  CHAMBER_CREATURE_FALL_STEP,
  PATTERN_SOURCE_PTR,
  CHAMBER_CREATURE_SPRITE,
} from "./names.js";

// The terrain pattern table: each column is 6 consecutive tile codes.
const PATTERN_TABLE = 0x3048;
const TILES_PER_COLUMN = 6;

// The video-RAM cell of the revealed column's bottom tile; each tile above it sits one
// tile-row (32 cells) higher in memory.
const COLUMN_BOTTOM_CELL = 0x938c;
const ONE_ROW_UP = 32;

// The element's two shimmer tile codes; the flip toggles strictly between them.
const FLIP_TILE_A = 56;
const FLIP_TILE_B = 57;

// The bounce band and the fall floor (both in element-local pixels).
const RIGHT_WALL = 56; // at or past this, step left
const LEFT_WALL = 25; // below this, step right
const STEP_LEFT = 255; // velocity byte for a leftward step (-1)
const STEP_RIGHT = 1; // velocity byte for a rightward step (+1)
const FLOOR_Y = 134; // Y clamps here when the fall reaches the floor

// The goal row the element sits on when it cues the reveal sound.
const GOAL_ROW = 107;

export function advanceChamberCreature(m) {
  const { mem8, mem16 } = m;

  // --- 1. Terrain reveal (only once the goal tile has been reached) ---
  if (mem8[GOAL_TILE_LATCH] !== 0) {
    // As the element rests on the goal row, cue the reveal sound.
    if (mem8[PIT_CROSS_ACTIVE] !== 0 && mem8[PLAYER_X] === GOAL_ROW) {
      requestSound11(m);
    }

    // Tick the reveal gate; reveal a column only on the frame it reaches zero.
    const gate = mem8[PIT_FLOOR_REVEAL_GATE] - 1;
    mem8[PIT_FLOOR_REVEAL_GATE] = gate;
    if (gate === 0) {
      // Reload the gate and step the cursor back one column through the pattern table.
      mem8[PIT_FLOOR_REVEAL_GATE] = mem8[PIT_FLOOR_REVEAL_PERIOD];
      const cursor = mem8[PIT_FLOOR_REVEAL_CURSOR] - TILES_PER_COLUMN;
      if (cursor >= 0) {
        // Still inside the table — stamp this column's 6 tiles up the video column.
        mem8[PIT_FLOOR_REVEAL_CURSOR] = cursor;
        const source = PATTERN_TABLE + cursor;
        mem16[PATTERN_SOURCE_PTR] = source;
        let cell = COLUMN_BOTTOM_CELL;
        for (let i = 0; i < TILES_PER_COLUMN; i++) {
          mem8[cell] = mem8[source + i];
          cell -= ONE_ROW_UP;
        }
      }
      // cursor < 0 → ran off the start of the table: the reveal is done, draw nothing.
    }
  }

  // --- 2. Shimmer clock ---
  const phase = mem8[CHAMBER_CREATURE_ANIM_PHASE] - 1;
  mem8[CHAMBER_CREATURE_ANIM_PHASE] = phase;

  // Off-beat: countdown still running and not the every-fourth frame — no motion, just
  // republish the element where it already is.
  const offBeat = phase !== 0 && phase % 4 !== 0;
  if (!offBeat) {
    if (phase === 0) {
      // Countdown expired: reload it and flip the shimmer tile to its other code.
      mem8[CHAMBER_CREATURE_ANIM_PHASE] = 8;
      const tile = mem8[CHAMBER_CREATURE_FRAME];
      mem8[CHAMBER_CREATURE_FRAME] = tile === FLIP_TILE_A ? FLIP_TILE_B : FLIP_TILE_A;
    }

    // --- 3a. Horizontal bounce ---
    const velocity = mem8[CHAMBER_CREATURE_X_VELOCITY];
    const newX = u8(mem8[CHAMBER_CREATURE_X] + velocity);
    mem8[CHAMBER_CREATURE_X] = newX;
    if (newX >= RIGHT_WALL) mem8[CHAMBER_CREATURE_X_VELOCITY] = STEP_LEFT;
    else if (newX < LEFT_WALL) mem8[CHAMBER_CREATURE_X_VELOCITY] = STEP_RIGHT;
    // else: mid-band, hold the current velocity.

    // --- 3b. Vertical fall ---
    const fallStep = mem8[CHAMBER_CREATURE_FALL_STEP] + 1; // accelerate the fall each frame
    mem8[CHAMBER_CREATURE_FALL_STEP] = fallStep;
    const newY = u8(mem8[CHAMBER_CREATURE_FALL_Y] + fallStep);
    mem8[CHAMBER_CREATURE_FALL_Y] = newY;
    if (newY >= FLOOR_Y) {
      // Reached the floor: clamp, draw a fresh small upward step so it rises again, and
      // advance the colour while holding the priority bit clear.
      mem8[CHAMBER_CREATURE_FALL_Y] = FLOOR_Y;
      mem8[CHAMBER_CREATURE_FALL_STEP] = (advanceRandom(m) | 0xf8) - 1;
      mem8[CHAMBER_CREATURE_ATTR] = (mem8[CHAMBER_CREATURE_ATTR] + 1) & 0xf7;
    }
  }

  // --- 4. Publish, then hand off to the object-record pass (its return is our exit) ---
  publishBackgroundSprite(m);
  return updateEnemy1(m);
}

/** Write the element's four screen-relative sprite bytes into its staging slot. */
function publishBackgroundSprite(m) {
  const { mem8 } = m;
  const bias = mem8[SPRITE_COORD_BIAS]; // cabinet coordinate bias (0 in normal play)
  mem8[CHAMBER_CREATURE_SPRITE] = mem8[CHAMBER_CREATURE_X] - bias;
  mem8[CHAMBER_CREATURE_SPRITE + 1] = mem8[CHAMBER_CREATURE_FRAME];
  mem8[CHAMBER_CREATURE_SPRITE + 2] = mem8[CHAMBER_CREATURE_ATTR];
  mem8[CHAMBER_CREATURE_SPRITE + 3] = mem8[CHAMBER_CREATURE_FALL_Y] + bias;
}
