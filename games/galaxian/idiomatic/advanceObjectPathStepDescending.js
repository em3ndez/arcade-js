// SPDX-License-Identifier: GPL-3.0-only
// Descending path-walk step for one object: subtract this step's X delta from the X field and advance
// the walk cursor, then subtract the Y delta too. Ticks the move throttle and, on expiry, the leg
// counter; a finished leg advances the dispatch state and reloads throttle, leg, heading and cursor.
// When the direction bit is set the Y half is handed to the ascending arm instead.
import { advanceObjectPathStepAscending } from "./advanceObjectPathStepAscending.js";
import { PATH_STEP_TABLE } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const STATE = 2;          // dispatch state index
const X_FIELD = 3;
const Y_FIELD = 4;
const ANGLE = 5;          // signed heading
const DIRECTION = 6;      // bit0 selects the ascending arm
const MOVE_THROTTLE = 16;
const LEG_COUNTER = 17;
const WALK_CURSOR = 19;   // index into the step table

export function advanceObjectPathStepDescending(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Apply this step's X delta; the cursor then advances (low-byte wrap) to the Y-delta entry.
  const cursor = mem8[obj + WALK_CURSOR];
  mem8[obj + X_FIELD] = mem8[obj + X_FIELD] - mem8[PATH_STEP_TABLE + cursor];
  const yPtr = PATH_STEP_TABLE + ((cursor + 1) & 0xff);

  if (mem8[obj + DIRECTION] & 0x01) return advanceObjectPathStepAscending(m, obj, yPtr);

  mem8[obj + Y_FIELD] = mem8[obj + Y_FIELD] - mem8[yPtr];
  mem8[obj + WALK_CURSOR] = cursor + 2;

  // Tick the move throttle; hold until it drains to zero.
  const throttle = (mem8[obj + MOVE_THROTTLE] - 1) & 0xff;
  mem8[obj + MOVE_THROTTLE] = throttle;
  if (throttle !== 0) return;

  // Throttle expired: reload it, step the heading down, and tick the leg counter.
  mem8[obj + MOVE_THROTTLE] = 4;
  mem8[obj + ANGLE] = mem8[obj + ANGLE] - 1;
  const leg = (mem8[obj + LEG_COUNTER] - 1) & 0xff;
  mem8[obj + LEG_COUNTER] = leg;
  if (leg !== 0) return;

  // Leg finished: advance the state and reload the next leg's throttle, counter, heading and cursor.
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
  mem8[obj + MOVE_THROTTLE] = 3;
  mem8[obj + LEG_COUNTER] = 12;
  mem8[obj + ANGLE] = 12;
  mem8[obj + WALK_CURSOR] = 0;
}
