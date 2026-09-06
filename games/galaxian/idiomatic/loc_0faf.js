// SPDX-License-Identifier: GPL-3.0-only
// Object state-handler (dispatch slot 9). Bumps the per-object counter and runs the
// flight-curve step, then — per the mode byte — optionally homes the object's column toward the target
// column before the shared body: screen Y = column + curve heading. A too-high Y enters state 5, a
// wrapped counter enters state 4; otherwise the move-throttle ticks and, on expiry, the state advances
// (dec). Failing that, gated by the object-active flag, it computes the octant and — when the
// delayed-event bit is clear — scans the row table, handing off the slot-claim on a match.
import { advanceObjectFlightCurve } from "./advanceObjectFlightCurve.js";
import { loc_11b0 } from "./loc_11b0.js";
import { loc_11e0 } from "./loc_11e0.js";
import { OBJ_ACTIVE_FLAG, loc_4202, loc_422b, loc_4213, loc_425f } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const OBJ_STATE = 0x02;     // dispatch state index
const OBJ_POS = 0x03;       // per-object frame/step counter
const OBJ_Y = 0x04;         // computed screen Y
const OBJ_COLUMN = 0x09;    // current column (homed toward the target) + screen-Y base
const MOVE_THROTTLE = 0x10; // move-throttle countdown
const OBJ_MODE = 0x17;      // mode selector
const OBJ_HEADING = 0x19;   // flight-curve heading hi-byte

export function loc_0faf(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance the per-object counter, then run the flight-curve integrator (updates the heading bytes).
  mem8[obj + OBJ_POS] = mem8[obj + OBJ_POS] + 1;
  advanceObjectFlightCurve(m, obj);

  // Mode selector decides whether to run the column-homing pre-step before the shared body:
  //   mode == 4 -> home only on odd frame parity; mode > 4 -> always home; mode < 4 -> skip.
  const mode = mem8[obj + OBJ_MODE];
  let chase;
  if (mode === 0x04) chase = (mem8[loc_425f] & 0x01) !== 0;
  else if (mode > 0x04) chase = true;
  else chase = false;

  if (chase) {
    // Home the current column toward the target column: step down when past it, up otherwise.
    if (mem8[loc_4202] < mem8[obj + OBJ_COLUMN]) {
      mem8[obj + OBJ_COLUMN] = mem8[obj + OBJ_COLUMN] - 1;
    } else {
      mem8[obj + OBJ_COLUMN] = mem8[obj + OBJ_COLUMN] + 1;
    }
  }

  // Shared body: screen Y = column + flight-curve heading; store it.
  const y = (mem8[obj + OBJ_COLUMN] + mem8[obj + OBJ_HEADING]) & 0xff;
  mem8[obj + OBJ_Y] = y;

  // Too high on screen ((Y+7) wraps below 0x0e): enter state 5.
  if (((y + 0x07) & 0xff) < 0x0e) {
    mem8[obj + OBJ_STATE] = 0x05;
    return;
  }

  // Counter ran out ((counter + 0x40) carries, i.e. counter >= 0xc0): enter state 4.
  if (mem8[obj + OBJ_POS] + 0x40 > 0xff) {
    mem8[obj + OBJ_STATE] = 0x04;
    return;
  }

  // Move-throttle countdown; on expiry advance the dispatch state (dec) and stop.
  const throttle = (mem8[obj + MOVE_THROTTLE] - 1) & 0xff;
  mem8[obj + MOVE_THROTTLE] = throttle;
  if (throttle === 0) {
    mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] - 1;
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
