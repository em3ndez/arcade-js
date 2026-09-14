// SPDX-License-Identifier: GPL-3.0-only
import { loc_29 } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * emitScaledByteDigit — place a scaled coordinate anchor, then draw one byte's digit there. ROM 0xd8a9.
 *
 * Role in the machine: draws a single glyph (one byte's worth of digits) positioned by a scaled (x, y)
 * coordinate. It is the pairing of "move the vector pen to this widened-by-four position" with "emit this
 * one stashed byte as a digit run" — used where a numeric glyph must sit at a specific scaled spot in the
 * tube's display space.
 *
 * Behavior: first stashes the byte to be drawn (a, default accumulator) into scratch loc_29 so the
 * coordinate step can freely use the registers. It then calls emitScaledCoordinateRecord(y, x), which
 * sign-extends and shifts both coordinates left by two into the vector delta pairs and emits the
 * positioning record. Finally it calls emitNibbleDigitRun(loc_29, 0x01) to lay the stashed byte down as a
 * single-entry glyph run at that anchored position.
 *
 * Live-out: scratch loc_29 = the drawn byte, the delta pairs and coordinate record written by the scale
 * step, one digit's glyph words, and the advanced draw cursor loc_74. Grounding: [seen].
 */
export function emitScaledByteDigit(m, a = m.regs.a, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  // Stash the byte to draw so the coordinate step can reuse the registers.
  mem8[loc_29] = a;
  // Position the pen: widen and emit the (y, x) coordinate record.
  emitScaledCoordinateRecord(m, y, x);
  // Draw the stashed byte as a single-entry digit run.
  emitNibbleDigitRun(m, loc_29, 0x01);
}
