// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceTwoSpriteActor — per-frame update for the two-sprite actor (a primary body plus its shadow
 * twin): dispatch by spawn state and animation phase, and on the running phases march it inline.
 * The actor is one ~32px-tall figure drawn from two hardware sprites, the twin locked one tile
 * alongside. Mid-spawn (BOARD_END_PHASE set) hands the frame to the spawn handler; otherwise it
 * routes on PLAY_PHASE_COUNTER (cycling ~0..25): phase 10+ the steady mover, 9 spawn the twin, 6..8
 * the rebuild-at-edge sibling, 0..5 the inline walk/march (3..5 first seed the actor once). The
 * inline walk ticks the cadence timer, flipping the two walk tiles and mirroring the paired frame
 * into the twin on underflow; every fourth tick it marches X past the left margin and descends Y.
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
const WALK_TILE_A = 46; // the two alternating walk-cycle tiles
const WALK_TILE_B = 175;

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
    mem8[ENEMY3_STEP_X] = -1; // step -1: march one cell left each tick, no vertical drift
    mem8[ENEMY3_STEP_Y] = 0;
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
