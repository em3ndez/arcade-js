// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdByte } from "./drawBcdByte.js";

/**
 * drawBcdWord — render a 16-bit BCD value as four decimal glyphs.
 *
 * WHAT IT IS
 *   Draws the 16-bit value held in DE as four BCD digit glyphs: the high byte (D) first, then the low
 *   byte (E). Each byte is emitted as two glyphs (high nibble then low) by drawBcdByte, so the pair
 *   comes out high-to-low across four glyph cells — a four-digit decimal readout.
 *
 * ROLE IN THE MACHINE
 *   A `jmp 0x09ad` entry reached from the score draw paths (loc_0988 and 0x1939). It is the shared
 *   four-digit renderer behind applyPendingScoreAdd (the running-score redraw) and drawScoreRecord
 *   (which draws the P1/P2/high-score BCD totals at each record's screen slot). Each glyph rides the
 *   standard text path: drawBcdByte
 *   -> drawDigit -> drawSprite8x8, and the returned HL walks the screen pointer one glyph cell forward
 *   per digit, so the four digits render as a run.
 *
 * ROM 0x09ad-0x09b1.  Grounding: [seen].
 * LIVE-OUT: HL advanced two glyph-pairs (four glyph cells) down the screen; DE preserved.
 */
// Draw the 16-bit value in DE as four BCD glyphs: the high byte first, then the low byte.
export function drawBcdWord(m, d = m.regs.d, e = m.regs.e) {
  // High byte first (the two most-significant digits), so the number reads left-to-right on screen.
  drawBcdByte(m, d);
  // Then the low byte (the two least-significant digits); its return carries HL for the caller.
  return drawBcdByte(m, e);
}
