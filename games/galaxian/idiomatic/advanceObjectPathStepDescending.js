// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectPathStepDescending -- object-AI state 10: the subtract-direction path-walk mirror.
 *
 * WHAT IT IS
 *   Slot 10 of the sixteen-entry object-AI state table (the RST-28 driveObjectSlot dispatch table at ROM
 *   0x0ce6, entered at ROM 0x101f). It is the subtract-direction mirror of advanceObjectPathStep: instead
 *   of adding the step-table deltas it subtracts them, walking the object the opposite way along its path.
 *
 * ROLE IN THE MACHINE
 *   Read the walk cursor (ix+0x13), subtract this step's X delta (PATH_STEP_TABLE 0x1e00 byte at the cursor)
 *   from X (ix+3), and form the pointer to the pair's Y-delta entry. If the direction bit (ix+6 bit0) is
 *   set, hand that Y pointer to advanceObjectPathStepAscending (the additive/mirrored arm) and return.
 *   Otherwise subtract the Y delta from Y (ix+4), advance the cursor past the pair (+2), and tick the move
 *   throttle (ix+0x10); while it runs, hold. On throttle expiry reload it to 4, step the signed heading
 *   (ix+5) down by one, and tick the leg counter (ix+0x11). When a leg finishes, advance the dispatch state
 *   (ix+2) and reload the next leg's constants: throttle = 3, leg = 12, heading = 12, cursor = 0.
 *
 * ROM 0x101f.  Grounding: [seen] (write-tap confirmed through the object-AI dispatch chain).
 *
 * LIVE-OUT: object record cells -- X ix+3, Y ix+4, walk cursor ix+0x13, move throttle ix+0x10,
 * heading ix+5, leg counter ix+0x11, state index ix+2 (or delegated to the ascending arm).
 */
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

  // Read the walk cursor (ix+0x13), subtract this step's X delta from X (ix+3), and point at the Y delta.
  const cursor = mem8[obj + WALK_CURSOR];
  mem8[obj + X_FIELD] = mem8[obj + X_FIELD] - mem8[PATH_STEP_TABLE + cursor];
  const yPtr = PATH_STEP_TABLE + ((cursor + 1) & 0xff);

  // Direction bit (ix+6 bit0) set: hand the Y half to the ascending/additive arm and return.
  if (mem8[obj + DIRECTION] & 0x01) return advanceObjectPathStepAscending(m, obj, yPtr);

  // Otherwise subtract the Y delta from Y (ix+4) and advance the cursor past the whole pair (+2).
  mem8[obj + Y_FIELD] = mem8[obj + Y_FIELD] - mem8[yPtr];
  mem8[obj + WALK_CURSOR] = cursor + 2;

  // Tick the move throttle (ix+0x10); hold in this leg until it drains to zero.
  const throttle = (mem8[obj + MOVE_THROTTLE] - 1) & 0xff;
  mem8[obj + MOVE_THROTTLE] = throttle;
  if (throttle !== 0) return;

  // Throttle expired: reload it, step the heading (ix+5) down by one, and tick the leg counter (ix+0x11).
  mem8[obj + MOVE_THROTTLE] = 4;
  mem8[obj + ANGLE] = mem8[obj + ANGLE] - 1;
  const leg = (mem8[obj + LEG_COUNTER] - 1) & 0xff;
  mem8[obj + LEG_COUNTER] = leg;
  if (leg !== 0) return;

  // Leg finished: advance the dispatch state (ix+2) and reload the next leg's throttle/counter/heading/cursor.
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
  mem8[obj + MOVE_THROTTLE] = 3;
  mem8[obj + LEG_COUNTER] = 12;
  mem8[obj + ANGLE] = 12;
  mem8[obj + WALK_CURSOR] = 0;
}
