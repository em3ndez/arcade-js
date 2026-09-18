// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedActorSpawnState — put the two-body actor (a primary sprite and its twin) into its fixed
 * starting state and drop it back to the un-spawned phase.
 *
 * The tail of the round/level parameter-seeding chain. Both bodies' records are written from
 * constants — nothing is read — so the pair always starts in the same pose; the per-field
 * constants below give each value's role. All writes land on distinct bytes, so order is moot.
 */

import {
  ENEMY3_ATTR,
  ENEMY3_STEP_X,
  ENEMY3_STEP_Y,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_X,
  ENEMY3_Y,
  BOARD_END_PHASE,
  ENEMY3_TWIN_ATTR,
  ENEMY3_TWIN_Y,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_TIMER,
  ENEMY3_TWIN_X,
  ENEMY3_TWIN_STEP_X,
  ENEMY3_TWIN_STEP_Y,
} from "./names.js";

export function seedActorSpawnState(m) {
  const { mem8 } = m;

  // Primary body.
  mem8[ENEMY3_X] = 36; // start column
  mem8[ENEMY3_TILE] = 46; // tile/sprite code
  mem8[ENEMY3_Y] = 0; // start row — top of the lane
  mem8[ENEMY3_ATTR] = 151;
  mem8[ENEMY3_STEP_X] = 0; // per-step move vector, low byte
  mem8[ENEMY3_STEP_Y] = 1; // per-step move vector, high byte
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed

  // Twin body — the primary shifted 16 columns right, next tile code.
  mem8[ENEMY3_TWIN_X] = 52; // twin start column (primary + 16)
  mem8[ENEMY3_TWIN_TILE] = 47; // twin tile code (one past the primary's)
  mem8[ENEMY3_TWIN_Y] = 0; // twin start row (mirror of the primary row)
  mem8[ENEMY3_TWIN_ATTR] = 151; // twin paired display byte (mirror of the primary's)
  mem8[ENEMY3_TWIN_STEP_X] = 0; // twin move vector, low byte
  mem8[ENEMY3_TWIN_STEP_Y] = 0; // twin move vector, high byte
  mem8[ENEMY3_TWIN_TIMER] = 1; // twin cadence timer, armed

  // Back to the un-spawned phase.
  mem8[BOARD_END_PHASE] = 0;
}
