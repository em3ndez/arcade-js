// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceTwoSpriteActor — per-frame update for the two-sprite actor (a primary body plus its
 * shadow twin): dispatch by spawn state and animation phase, and on the running
 * phases march + walk-animate it inline.  ROM 0x3748.
 *
 * The two-sprite actor is one ~32px-tall figure drawn from two hardware sprites — a
 * primary body and a twin locked one tile alongside it. Each frame it lands here and
 * is routed from two control bytes:
 *
 *   - Still mid-spawn (BOARD_END_PHASE set): hand the frame to the spawn handler.
 *   - Otherwise route on the animation phase, a counter that cycles ~0..25 each round:
 *       * phase 10+ : the steady per-frame mover (decompiled, called directly).
 *       * phases 6..8 : the rebuild-at-edge sibling.
 *       * phase 9 : spawn the twin figure.
 *       * phases 0..5 : run the walk / march below (phases 3..5 first seed the actor
 *         once, on the first frame it becomes live).
 *
 * The one-shot seed (phases 3..5, only while the actor is not yet present): set the
 * step vector to march one cell left with no vertical drift, mark the actor present so
 * later frames animate instead of re-seeding, and park its start cell.
 *
 * The inline walk / march (phases 0..5):
 *   - Tick the cadence timer. On underflow, reload it and flip the walk tile between
 *     its two frames (46 / 175), mirroring the paired frame (tile with its low bit
 *     flipped) into the twin.
 *   - Only every fourth tick: march the actor's X by its step once it is past the left
 *     margin (17), placing the twin 16 cells ahead; then descend its Y by its step
 *     until it reaches the floor (23), mirroring that into the twin.
 *   - Always finish by staging the two hardware sprite records.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3748.test.js.
 * GATE:     captured attract dispatches (5 of the 6 arms occur naturally) + crafted
 *           entries for the alt-phase-spawn arm and the one-shot seed body; teeth.
 *           RAM-only — pc/SP diverge by construction on the tail-jump ladder, and the
 *           dead stack scratch the spawn arm's sound call pushes is excluded.
 * LIVE-OUT: memory-only — the actor/twin records, the flipped walk tiles, the seeded
 *           step vector / presence flag / start cell, the staged sprite records, and
 *           everything the dispatched handler writes. The value registers/flags and the
 *           Z80 stack the oracle threads are dead ABI (this sits on a tail-jump ladder
 *           whose callers reload the register file next frame); the full-RAM gate
 *           backstops that.
 * NAMES:    BOARD_END_PHASE, PLAY_PHASE_COUNTER, PLAYER_ACTIVE, PLAYER_Y, ENEMY3_STEP_X/ENEMY3_STEP_Y,
 *           ENEMY3_TIMER, ENEMY3_TILE/ENEMY3_TWIN_TILE, ENEMY3_X/ENEMY3_TWIN_X, ENEMY3_Y/ENEMY3_TWIN_Y from
 *           names.js. The steady per-frame mover at 0x3a13 is the decompiled
 *           advanceActorMovers, called directly.
 */

import {
  ENEMY3_STEP_X, ENEMY3_STEP_Y, ENEMY3_TILE, ENEMY3_TIMER, ENEMY3_X, ENEMY3_Y,
  PLAY_PHASE_COUNTER, PLAYER_Y, PLAYER_ACTIVE, BOARD_END_PHASE, ENEMY3_TWIN_Y, ENEMY3_TWIN_TILE, ENEMY3_TWIN_X,
} from "./names.js";
import { spawnAltPhaseActor } from "./spawnAltPhaseActor.js";
import { advanceOrRebuildTwinActor } from "./advanceOrRebuildTwinActor.js";
import { spawnTwinActor } from "./spawnTwinActor.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";
import { advanceActorMovers } from "./advanceActorMovers.js";

const LEFT_MARGIN = 17; // the actor only marches X once it is at or past this column
const FLOOR = 23; // the actor only descends Y while it is above this row
const TWIN_LEAD = 16; // the twin sits this many cells ahead of the body along X
const CADENCE_RELOAD = 8; // frames between walk-tile flips
const WALK_TILE_A = 46; // one of the two alternating walk-cycle tiles
const WALK_TILE_B = 175; // the other

export function advanceTwoSpriteActor(m) {
  const { mem8 } = m;

  // Still mid-spawn: let the spawn handler own the frame.
  if (mem8[BOARD_END_PHASE] !== 0) return spawnAltPhaseActor(m);

  // Route on where we are in the actor's animation cycle.
  const phase = mem8[PLAY_PHASE_COUNTER];
  if (phase >= 10) return advanceActorMovers(m); // steady per-frame mover (decompiled, called directly)
  if (phase >= 9) return spawnTwinActor(m); // phase 9: spawn the twin figure
  if (phase >= 6) return advanceOrRebuildTwinActor(m); // phases 6..8: rebuild the actor at the edge
  // phases 0..5 run the inline walk / march below.

  // Phases 3..5 seed the actor once, on the first frame it becomes live.
  if (phase >= 3 && mem8[PLAYER_ACTIVE] === 0) {
    mem8[ENEMY3_STEP_X] = -1; // step -1: march one cell left each tick
    mem8[ENEMY3_STEP_Y] = 0; // no vertical drift
    mem8[PLAYER_ACTIVE] = 255; // mark present so later frames animate, not re-seed
    mem8[PLAYER_Y] = 45; // park the actor's start cell
  }

  // Inline walk / march. Read the step vector (freshly seeded above on the first frame).
  const stepX = mem8[ENEMY3_STEP_X];
  const stepY = mem8[ENEMY3_STEP_Y];

  // Tick the cadence timer; on underflow, reload it and flip the walk tile.
  const nextTimer = mem8[ENEMY3_TIMER] - 1;
  mem8[ENEMY3_TIMER] = nextTimer;
  if (nextTimer === 0) {
    mem8[ENEMY3_TIMER] = CADENCE_RELOAD;
    const walkTile = mem8[ENEMY3_TILE] === WALK_TILE_A ? WALK_TILE_B : WALK_TILE_A;
    mem8[ENEMY3_TILE] = walkTile;
    mem8[ENEMY3_TWIN_TILE] = walkTile ^ 1; // twin shows the paired frame (low bit flipped)
  }

  // The actor advances only on every fourth tick.
  if ((mem8[ENEMY3_TIMER] & 3) === 0) {
    // March along X once past the left margin; place the twin ahead of the body.
    if (mem8[ENEMY3_X] >= LEFT_MARGIN) {
      const newX = mem8[ENEMY3_X] + stepX;
      mem8[ENEMY3_X] = newX;
      mem8[ENEMY3_TWIN_X] = newX + TWIN_LEAD;

      // Descend along Y until the actor reaches the floor; mirror into the twin.
      if (mem8[ENEMY3_Y] < FLOOR) {
        const newY = mem8[ENEMY3_Y] + stepY;
        mem8[ENEMY3_Y] = newY;
        mem8[ENEMY3_TWIN_Y] = newY;
      }
    }
  }

  // Build the two hardware sprite records the display draws the actor with.
  return stageActorSpriteRecords(m);
}
