// SPDX-License-Identifier: GPL-3.0-only
import { latchActorStepThenDispatchByStageCountdown } from "./latchActorStepThenDispatchByStageCountdown.js";

/**
 * advanceActorPositionByVelocity
 *
 * WHAT IT IS
 * The shared low-level motion primitive for a moving actor: it steps one actor's
 * position byte forward by that actor's own per-frame velocity, and spends one unit
 * of a lap/lifetime counter whenever the step carries the position past zero.
 *
 * ROLE IN THE MACHINE
 * Every actor record in the arena carries a small motion sub-block:
 *   - rec+0x05  the position byte (a sub-position / fine X the actor marches along)
 *   - rec+0x06  a lap/lifetime counter (in the homing-enemy path, the coarse row
 *               counter that ticks down as the fine position rolls over)
 *   - rec+0x0a  the signed per-frame velocity added to the position each frame
 * A homing enemy walking itself toward "arrival" advances its fine sub-position
 * (rec+0x05) by the homing velocity (rec+0x0a); when that fine position underflows
 * past zero the coarse row counter (rec+0x06) is nudged down by one, so the enemy
 * counts off whole rows as its fractional position wraps. This routine performs
 * exactly that one step. The velocity is a signed byte: a small negative velocity
 * (moving toward zero) is what eventually carries the position across the zero
 * boundary and consumes a lap.
 *
 * ROM 0x13FE-0x140F.
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. Conditionally decrements the lap counter at rec+0x06;
 * the advanced position byte is handed to the stage-countdown step handler, which
 * stores it back into rec+0x05 and drives the actor's per-frame update. The value
 * this routine returns is whatever that downstream handler produces.
 */

const VELOCITY_FIELD = 0x0a; // signed per-frame velocity added to the position byte (rec+0x0a)
const X_FIELD = 0x05; //       current position byte the actor marches along (rec+0x05)
const LAP_FIELD = 0x06; //     lap/lifetime (coarse row) counter, spent on a wrap past zero (rec+0x06)

export function advanceActorPositionByVelocity(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Read the two motion inputs straight out of the actor record: the signed
  // per-frame velocity (rec+0x0a) and the current position byte (rec+0x05).
  const velocity = mem8[rec + VELOCITY_FIELD];
  const x = mem8[rec + X_FIELD];

  // WRAP DETECTION (ROM 0x1401-0x140a). The hardware negates the velocity and
  // compares the current position against it: if the position is below the negated
  // velocity, adding the velocity this frame will carry the position past zero.
  // That is a wrap, and each wrap spends one unit of the lap/lifetime counter at
  // rec+0x06 -- the mechanism by which a homing actor's coarse row counter ticks
  // down every time its fine position rolls over the zero boundary. When the
  // position is at or above the threshold no wrap occurs and the counter is left
  // untouched.
  if (x < ((-velocity) & 0xff)) {
    mem8[rec + LAP_FIELD] = mem8[rec + LAP_FIELD] - 1;
  }

  // ADVANCE + HAND OFF (ROM 0x140d onward). Add the raw velocity back onto the
  // position (byte-wrapping in 0..255) to get this frame's new position, then hand
  // that value to the stage-countdown step handler, which latches it into rec+0x05
  // and carries the actor through the rest of its per-frame update.
  return latchActorStepThenDispatchByStageCountdown(m, rec, (x + velocity) & 0xff);
}
