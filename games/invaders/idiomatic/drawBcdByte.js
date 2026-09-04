// SPDX-License-Identifier: GPL-3.0-only
import { drawDigit } from "./drawDigit.js";

/**
 * drawBcdByte — draw one packed-BCD byte as two decimal glyphs.
 *
 * WHAT IT IS
 *   Renders a byte holding two packed BCD digits as two on-screen numerals: the high nibble first, then
 *   the low nibble. Each nibble of a BCD byte is already a decimal digit 0-9, so the two nibbles map
 *   straight onto two digit glyphs.
 *
 * ROLE IN THE MACHINE
 *   The two-digit rung of the numeric-drawing stack. drawDigit (0x09c5) is the single-digit leaf: it adds
 *   0x1a to the nibble to reach that digit's glyph id and plots it with drawSprite8x8, returning HL
 *   advanced one glyph-cell so the next digit chains on. drawBcdByte calls it twice; drawBcdWord (0x09ad)
 *   in turn calls drawBcdByte twice to lay down a four-digit score/credit word. Direct callers include
 *   drawCreditCount (the credit tally). A is the byte to draw, defaulting to the Z80 accumulator.
 *
 * ROM 0x09b2-....  Grounding: [seen].
 *
 * LIVE-OUT: HL, advanced past both glyphs (drawDigit's live-out), so a following draw continues in line.
 */
export function drawBcdByte(m, a = m.regs.a) {
  // High decimal digit first: shift the top nibble down and plot it.
  drawDigit(m, (a >> 4) & 0x0f);
  // Then the low decimal digit; drawDigit returns HL advanced one glyph-cell, which becomes this call's
  // (and the caller's) live-out HL.
  return drawDigit(m, a & 0x0f);
}
