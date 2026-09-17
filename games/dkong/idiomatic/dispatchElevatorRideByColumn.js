// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchElevatorRideByColumn — while Mario is standing on an elevator and grounded, route him
 * to the up-column or down-column carry by his X band; every X outside both bands takes a third
 * arm. Dropped unless he is aboard a lift and not airborne.
 *
 * LIVE-OUT: memory-only — whatever the dispatched arm writes.
 */

import { EDGE_REPOSITION_FLAG, MARIO_AIRBORNE, MARIO_X } from "./names.js";
import { loc_2766 } from "./loc_2766.js";
import { carryMarioUpWithLift } from "./carryMarioUpWithLift.js";
import { carryMarioDownWithLift } from "./carryMarioDownWithLift.js";

// One band per lift column: lower band rises (carry UP), higher band descends (carry DOWN).
const MOVER_276F_BAND_LO = 44;   // [44, 67)
const MOVER_276F_BAND_HI = 67;
const MOVER_2787_BAND_LO = 108;  // [108, 131)
const MOVER_2787_BAND_HI = 131;

export function dispatchElevatorRideByColumn(m) {
  const { mem8 } = m;

  if (mem8[EDGE_REPOSITION_FLAG] === 0) return; // not standing on a lift
  if (mem8[MARIO_AIRBORNE] !== 0) return;       // airborne -> leave for a grounded frame

  const x = mem8[MARIO_X];
  if (x < MOVER_276F_BAND_LO) { loc_2766(m); return; }
  if (x < MOVER_276F_BAND_HI) { carryMarioUpWithLift(m); return; }
  if (x < MOVER_2787_BAND_LO) { loc_2766(m); return; }
  if (x < MOVER_2787_BAND_HI) { carryMarioDownWithLift(m); return; }
  loc_2766(m);
}
