// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectPathStepAscending -- the ascending/mirrored arm of the path-walk step.
 *
 * WHAT IT IS
 *   The additive Y half of the descending path-walk handler (ROM 0x101f). When an object's direction bit
 *   selects the mirrored arm, advanceObjectPathStepDescending hands its Y-delta pointer here instead of
 *   subtracting, so this routine adds the step byte -- walking the object upward/back rather than down.
 *   The step pointer arrives in HL, already positioned by the caller at the PATH_STEP_TABLE Y-delta entry.
 *
 * ROLE IN THE MACHINE
 *   Add the step-table byte at the pointer to Y (ix+4) and store the advanced cursor (pointer low byte + 1)
 *   into the walk cursor (ix+0x13). Then tick the move throttle (ix+0x10); while it still runs, hold. On
 *   throttle expiry reload it to 4, step the signed heading (ix+5) up by one, and tick the leg counter
 *   (ix+0x11). When a leg finishes, advance the dispatch state (ix+2) and reload the next leg's constants:
 *   throttle = 3, leg = 12, heading = 244 (-12 as a signed byte), cursor = 0.
 *
 * ROM 0x1060.  Grounding: [seen] (write-tap confirmed through the object-AI dispatch chain).
 *
 * LIVE-OUT: object record cells -- Y ix+4, walk cursor ix+0x13, move throttle ix+0x10, heading ix+5,
 * leg counter ix+0x11, state index ix+2.
 */

// Field offsets within the object record addressed by `obj`.
const STATE = 0x02;           // dispatch state index
const Y_FIELD = 0x04;
const ANGLE = 0x05;           // signed heading
const MOVE_THROTTLE = 0x10;
const LEG_COUNTER = 0x11;
const WALK_CURSOR = 0x13;     // index into the step table

export function advanceObjectPathStepAscending(m, obj = m.regs.ix, ptr = m.regs.hl) {
  const { mem8 } = m;

  // Apply this step's Y delta (byte at the step pointer) and store the advanced cursor (ptr low byte + 1).
  mem8[obj + Y_FIELD] = mem8[obj + Y_FIELD] + mem8[ptr];
  mem8[obj + WALK_CURSOR] = ptr + 1;

  // Tick the move throttle (ix+0x10); hold in this leg until it drains to zero.
  const throttle = (mem8[obj + MOVE_THROTTLE] - 1) & 0xff;
  mem8[obj + MOVE_THROTTLE] = throttle;
  if (throttle !== 0) return;

  // Throttle expired: reload it, step the heading (ix+5) up by one, and tick the leg counter (ix+0x11).
  mem8[obj + MOVE_THROTTLE] = 4;
  mem8[obj + ANGLE] = mem8[obj + ANGLE] + 1;
  const leg = (mem8[obj + LEG_COUNTER] - 1) & 0xff;
  mem8[obj + LEG_COUNTER] = leg;
  if (leg !== 0) return;

  // Leg finished: advance the dispatch state (ix+2) and reload the next leg's throttle/counter/heading/cursor.
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
  mem8[obj + MOVE_THROTTLE] = 3;
  mem8[obj + LEG_COUNTER] = 12;
  mem8[obj + ANGLE] = 244;
  mem8[obj + WALK_CURSOR] = 0;
}
