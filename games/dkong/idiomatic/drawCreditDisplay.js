// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditDisplay — paint the "CREDIT nn" line: draw canned string 5 ("CREDIT") down its tilemap
 * column, then render the one-byte packed-BCD CREDITS count as two digits into the display column,
 * stepping one tilemap row UP between the high and low digit. With no coins the count is 0 ("00").
 *
 * The digit render is a TAIL position — the expander's return goes to this routine's caller, so
 * nothing follows the call.
 *
 * LIVE-OUT: memory (the glyph and digit cells), plus whatever registers the expander leaves.
 */
import { CREDITS } from "./names.js";
import { drawStringVertical } from "./drawStringVertical.js";
import { expandBcdDigits } from "./expandBcdDigits.js";

const CREDIT_STRING_INDEX = 0x05;
const CREDIT_DIGITS_VRAM = 0x74bf; // high digit here, low digit one row up
const DIGIT_ROW_STEP = 0xffe0; // step one tilemap row up between the two digits

export function drawCreditDisplay(m) {
  const { regs } = m;

  regs.a = CREDIT_STRING_INDEX;
  drawStringVertical(m);

  // The expander takes source pointer, destination cursor, per-digit stride, source-byte count.
  regs.hl = CREDITS;
  regs.de = DIGIT_ROW_STEP;
  regs.ix = CREDIT_DIGITS_VRAM;
  regs.b = 0x01;
  expandBcdDigits(m);
}
