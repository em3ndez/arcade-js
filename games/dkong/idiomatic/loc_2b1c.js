// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b1c — run the descent probe against Mario's context block and, on a normal probe
 * result, run the board-gated object-collision follow-up and hand back a zeroed result pair.
 *
 * Three steps, and the middle one decides whether the third happens:
 *
 *  1. Point the object pointer at Mario's context block. Everything below inherits it: the
 *     probe passes it through to the tile classifier, whose tail reads Mario's Y out of the
 *     block to measure how far the descent has come.
 *
 *  2. Run the descent probe. Its false result is a two-frame unwind that abandons the probe and
 *     returns past this routine to its own caller. Returning early is what propagates that: the
 *     follow-up and the result pair below are exactly the code the unwind skips, so on that path
 *     the probe's own result pair is what the caller reads.
 *
 *  3. Normal probe result: run the object-collision follow-up, then report a zeroed result pair.
 *     The follow-up is gated on the board — it rotates a fixed bit pattern right once per board
 *     and runs its body only when the bit rotated out is set, so exactly one board opens it and
 *     on every other it returns having done nothing.
 *
 * The airborne per-frame handler that reaches this routine reads the result pair back and
 * branches on it, so both bytes are live-out.
 *
 * The follow-up can report a skip of its own, and it is deliberately DISCARDED here: the zeroed
 * result pair is written on every path through this arm.
 *
 * LIVE-OUT: the two result bytes, and a return value that is always undefined — this routine is
 * not itself a caller-skip, and both of its paths land its caller at the same continuation. It
 * writes no memory of its own; the memory that moves is what the probe cascade and the
 * follow-up write.
 */

import { probeMarioDescentLanding } from "./probeMarioDescentLanding.js";
import { MARIO_ACTIVE } from "./names.js";

/**
 * @param {object} m  the machine. No register live-in. Live-out: the two result bytes.
 * @returns {undefined} always — both paths return to the caller's single continuation.
 */
export function loc_2b1c(m) {
  const { regs } = m;

  // The probe and everything under it works off Mario's context block.
  regs.ix = MARIO_ACTIVE;

  // The probe's unwind abandons the rest of this routine; the caller reads the probe's own
  // result pair on that path.
  if (!probeMarioDescentLanding(m)) return;

  // Normal probe result: the board-gated object-collision follow-up, then a zeroed result pair.
  // The follow-up's own skip signal is deliberately discarded — see the header.
  m.call(0x29af);
  regs.a = 0;
  regs.b = 0;
}
