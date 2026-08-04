// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditDisplay — paint the "CREDIT nn" line: the label plus the credit count.
 *
 * Two steps, both pure output:
 *
 *   1. Draw canned string 5 — the letters "CREDIT" — down its tilemap column, through
 *      the shared vertical string renderer. (String 4, for reference, is "HIGH SCORE".)
 *   2. Render the one-byte credit count CREDITS (packed BCD) as its two digits into the
 *      display column, stepping one tilemap row UP between the high and low digit,
 *      through the shared packed-BCD digit expander.
 *
 * The second step is a TAIL position: the expander's own return goes to this routine's
 * caller rather than back here, which is why nothing follows the call.
 *
 * With no coins inserted the count is 0, so the digits render as "00".
 *
 * LIVE-OUT: memory (the "CREDIT" glyph cells and the two digit cells), plus whatever
 * registers the digit expander leaves, since this routine tails into it.
 */
import { CREDITS } from "./names.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { expandBcdDigits } from "./expandBcdDigits.js";

// -- Fixed constants baked into this routine; none is a work-RAM cell --
const CREDIT_STRING_INDEX = 0x05; // "CREDIT" in the canned string table
const CREDIT_DIGITS_VRAM = 0x74bf; //  video cursor: high digit here, low digit one row up
const DIGIT_ROW_STEP = 0xffe0; //      step one tilemap row up between the two digits

export function drawCreditDisplay(m) {
  const { regs } = m;

  // 1. Draw the "CREDIT" label (canned string 5), down its tilemap column.
  regs.a = CREDIT_STRING_INDEX;
  drawStringVertical(m);

  // 2. Render the credit count (one packed-BCD byte) as two digits. The expander takes
  //    the source pointer, the destination cursor, the per-digit stride and the
  //    source-byte count. TAIL position: its return goes to this routine's caller.
  regs.hl = CREDITS;
  regs.de = DIGIT_ROW_STEP;
  regs.ix = CREDIT_DIGITS_VRAM;
  regs.b = 0x01; // one source byte -> two digits
  expandBcdDigits(m);
}
