// SPDX-License-Identifier: GPL-3.0-only
// Object state-handler (dispatch slot 3). Bumps the per-object counter and runs the
// flight-curve step, then folds the per-object increment plus the curve heading hi-byte into a new
// screen Y. A too-high Y advances the dispatch state by 2; a wrapped counter by 1. Otherwise, gated by
// the object-active flag, it computes the direction octant and — when the delayed-event bit
// is clear — scans the row table for the counter value, handing off the slot-claim on a match.
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { loc_11b0 } from "./loc_11b0.js";
import { loc_11e0 } from "./loc_11e0.js";
import { OBJ_ACTIVE_FLAG, loc_422b, loc_4213 } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const OBJ_STATE = 0x02;   // dispatch state index
const OBJ_POS = 0x03;     // per-object frame/step counter
const OBJ_Y = 0x04;       // computed screen Y
const OBJ_INC = 0x09;     // per-object Y increment
const OBJ_HEADING = 0x19; // flight-curve heading hi-byte

export function loc_0e2b(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance the per-object counter, then run the flight-curve integrator (updates the heading bytes).
  mem8[obj + OBJ_POS] = mem8[obj + OBJ_POS] + 1;
  advanceObjectFlightCurve(m, obj);

  // Screen Y = per-object increment + flight-curve heading; store it.
  const y = (mem8[obj + OBJ_INC] + mem8[obj + OBJ_HEADING]) & 0xff;
  mem8[obj + OBJ_Y] = y;

  // Too high on screen ((Y+7) wraps below 0x0e): advance the dispatch state by 2.
  if (((y + 0x07) & 0xff) < 0x0e) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 2;
    return;
  }

  // Counter ran out ((counter + 0x48) carries, i.e. counter >= 0xb8): advance the state by 1.
  if (mem8[obj + OBJ_POS] + 0x48 > 0xff) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1;
    return;
  }

  // Gated by the object-active flag bit0: clear -> stop this frame.
  if ((mem8[OBJ_ACTIVE_FLAG] & 0x01) === 0) return;

  // Compute the direction octant toward the target and store it in the object record.
  loc_11b0(m, obj);

  // Gated by the delayed-event bit0: set -> stop.
  if ((mem8[loc_422b] & 0x01) !== 0) return;

  // Scan the row table: low byte = row count, high byte = the match value.
  let count = mem8[loc_4213];
  const matchValue = mem8[loc_4213 + 1];
  let a = mem8[obj + OBJ_POS];
  for (;;) {
    if (a === matchValue) return loc_11e0(m, obj); // row matched -> hand off
    a = (a + 0x19) & 0xff;                         // next row stride
    count = (count - 1) & 0xff;
    if (count === 0) break;
  }
}
