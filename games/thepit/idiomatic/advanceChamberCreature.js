// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceChamberCreature — per-frame driver for the left-chamber creature's sprite (§2.8): bounce
 * it sideways within a fixed band, accelerate its own fall-Y until it hits the floor and RNG-resets,
 * cycle its sprite frame, publish its screen-relative sprite record, and — once the goal-zone latch
 * is set — dissolve one more column of the Pit sliding-floor reveal into view.  ROM 0x2f71.
 *
 * This drives the live slot-3 creature in the left chamber (§2.8). It is NOT the "Zonker tank +
 * shell": that tank is baked top-right scenery (§2.9), and 0x80de is the creature's OWN
 * accelerating fall-Y, not a lobbed shell. The creature's canonical identity (caged specimen /
 * decorative monster) is [guess]; its mechanism is grounded.
 *
 * Every frame this element does four things, in order:
 *
 *   1. Pit sliding-floor reveal (only once the goal-zone latch is set). While that gate
 *      is set, a per-frame countdown lets one column through at a time: when it reaches
 *      zero it reloads and steps a cursor back one 6-tile column through the tile-pattern
 *      table, then stamps those 6 tiles up a fixed video-RAM column (bottom cell first,
 *      one tile-row higher each tile), so a 6-tile bar dissolves (0x36 -> ... -> 0x27).
 *      When the cursor runs off the start of the table the reveal is finished and nothing
 *      is drawn. As the player rests on the goal row this stage also cues the reveal sound
 *      once. Before the latch is set the whole stage is skipped.
 *   2. Frame clock. A phase countdown ticks once per frame. On the frame it expires
 *      it reloads and flips the creature's tile between its two codes; otherwise the
 *      creature only moves every fourth frame (off-beat frames just republish).
 *   3. Position. Horizontal bounce: X steps by a velocity that reverses to leftward at
 *      the right wall and to rightward at the left wall, so the creature paces within a
 *      fixed band. Vertical drop: its fall-Y adds an ever-accelerating step until it
 *      reaches the floor, where it clamps, draws a fresh random step to start dropping
 *      again, and advances its colour (holding the priority bit clear).
 *   4. Publish. Writes the creature's four sprite bytes — X and Y made screen-relative
 *      by the cabinet coordinate bias, plus its tile and colour — into its sprite
 *      staging slot, then hands off to the object-record pass (updateEnemy1) that
 *      moves and publishes the two foreground objects; that pass's return unwinds
 *      straight to our caller, so the hand-off IS this routine's exit.
 *
 * This is the real per-frame monolith. Its position-step and publish step exist
 * only here (they have no standalone form), so they are carried inline; the reveal and
 * frame-clock bodies also have standalone callable twins (revealTerrainColumn /
 * advanceChamberCreatureAnimation), but those twins hand off through the still-oracle
 * position-step/publish, so the monolith cannot reuse them and reproduces the body itself.
 * The three already-decompiled routines it calls — the reveal-sound trigger, the random
 * generator, and the object-record pass — are all called directly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f71.test.js.
 * GATE:     crafted-entry — dispatched every frame in attract (~460x / 1000 frames), so
 *           real entry states are captured at this address and idiomatic-vs-oracle run
 *           on clones. Attract never reaches the goal, so its terrain-reveal + reveal-
 *           sound arms are exercised by poked entries (goal latch on, gate/cursor set),
 *           as is the floor clamp that draws a random step; the always-run shimmer +
 *           bounce + publish are covered by the real captures. The oracle's transient
 *           register-save scratch just below the entry stack pointer is dead and
 *           excluded from the diff. Teeth twins (wrong published byte, dropped reveal
 *           tile) are caught.
 * LIVE-OUT: memory-only — the element's position/animation work bytes, the six revealed
 *           video-RAM tiles, and its published sprite record; the routine tail-jumps, so
 *           its caller consumes no register and the object-record pass owns everything
 *           after the hand-off, identically both sides. Leftover registers/flags are dead.
 * NAMES:    GOAL_TILE_LATCH, PIT_CROSS_ACTIVE, PLAYER_X, PIT_FLOOR_REVEAL_GATE/PERIOD/CURSOR,
 *           CHAMBER_CREATURE_ANIM_PHASE, CHAMBER_CREATURE_X/FRAME/ATTR/Y, SPRITE_COORD_BIAS from ram.js.
 *           Still hex: the pattern-table scratch pointer (0x80e1), the bounce velocity
 *           (0x80df), the fall step (0x80e0), and the sprite-staging slot (0x822c) —
 *           none carry a ram.js name. Delegates to the decompiled requestSound11,
 *           advanceRandom, and updateEnemy1 (the tail-jump object-record pass).
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
} from "./ram.js";

// The terrain pattern table: each column is 6 consecutive tile codes.
const PATTERN_TABLE = 0x3048;
const TILES_PER_COLUMN = 6;

// The video-RAM cell of the revealed column's bottom tile; each tile above it sits one
// tile-row (32 cells) higher in memory.
const COLUMN_BOTTOM_CELL = 0x938c;
const ONE_ROW_UP = 32;

// The scratch pointer the backdrop machinery leaves the reveal source in (unnamed RAM).
const PATTERN_SCRATCH_PTR = 0x80e1;

// The element's two shimmer tile codes; the flip toggles strictly between them.
const FLIP_TILE_A = 56;
const FLIP_TILE_B = 57;

// The bounce band and the fall floor (both in element-local pixels).
const RIGHT_WALL = 56; // at or past this, step left
const LEFT_WALL = 25; // below this, step right
const STEP_LEFT = 255; // velocity byte for a leftward step (-1)
const STEP_RIGHT = 1; // velocity byte for a rightward step (+1)
const FLOOR_Y = 134; // Y clamps here when the fall reaches the floor

// The element's bounce velocity and its accelerating fall step (unnamed RAM).
const BOUNCE_VELOCITY = 0x80df;
const FALL_STEP = 0x80e0;

// The element's sprite-staging slot (4 bytes: X, tile, colour, Y).
const SPRITE_SLOT = 0x822c;

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
        mem16[PATTERN_SCRATCH_PTR] = source;
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
    const velocity = mem8[BOUNCE_VELOCITY];
    const newX = u8(mem8[CHAMBER_CREATURE_X] + velocity);
    mem8[CHAMBER_CREATURE_X] = newX;
    if (newX >= RIGHT_WALL) mem8[BOUNCE_VELOCITY] = STEP_LEFT;
    else if (newX < LEFT_WALL) mem8[BOUNCE_VELOCITY] = STEP_RIGHT;
    // else: mid-band, hold the current velocity.

    // --- 3b. Vertical fall ---
    const fallStep = mem8[FALL_STEP] + 1; // accelerate the fall each frame
    mem8[FALL_STEP] = fallStep;
    const newY = u8(mem8[CHAMBER_CREATURE_FALL_Y] + fallStep);
    mem8[CHAMBER_CREATURE_FALL_Y] = newY;
    if (newY >= FLOOR_Y) {
      // Reached the floor: clamp, draw a fresh small upward step so it rises again, and
      // advance the colour while holding the priority bit clear.
      mem8[CHAMBER_CREATURE_FALL_Y] = FLOOR_Y;
      mem8[FALL_STEP] = (advanceRandom(m) | 0xf8) - 1;
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
  mem8[SPRITE_SLOT] = mem8[CHAMBER_CREATURE_X] - bias; // X, screen-relative
  mem8[SPRITE_SLOT + 1] = mem8[CHAMBER_CREATURE_FRAME]; // tile / frame code
  mem8[SPRITE_SLOT + 2] = mem8[CHAMBER_CREATURE_ATTR]; // colour + priority
  mem8[SPRITE_SLOT + 3] = mem8[CHAMBER_CREATURE_FALL_Y] + bias; // Y, screen-relative
}
