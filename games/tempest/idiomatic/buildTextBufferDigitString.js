// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2a, WORK_PTR_LO, WORK_PTR_HI } from "./names.js";
import { writeNibbleGlyphToTextBuffer } from "./writeNibbleGlyphToTextBuffer.js";

/**
 * buildTextBufferDigitString -- render a 3-byte packed-BCD field as a digit-glyph run. ROM 0xa9d7.
 *
 * Role in the machine: score and counter overlays store their numbers as packed BCD (two decimal
 * digits per byte). This routine expands three such bytes into six digit glyphs in the text/vector
 * buffer, threading a carry so a leading run of zeros can be blanked (leading-zero suppression) while
 * the very last digit is always shown. It is the tail called by the marker/overlay row emitters
 * (buildMarkerRowVectorList, buildTextOverlayList).
 *
 * Behavior: loc_2a is the pass counter, set to 2 and counted down through 0 (three passes). The source
 * pointer WORK_PTR_LO/HI points at the most-significant byte and walks backward one byte per pass. Each
 * pass reads the byte and writes its high nibble then its low nibble via writeNibbleGlyphToTextBuffer,
 * advancing the buffer cursor x. carry starts true (suppress) and is cleared for good the moment a
 * nonzero nibble is emitted -- a zero nibble leaves carry unchanged, so glyphs stay blanked until the
 * first significant digit. On the final pass (loc_2a == 0) carry is forced clear before the low nibble
 * so the units digit always prints even when the number is zero. The loop ends when the pass counter
 * decrements past zero (wraps to >= 0x80).
 *
 * Live-out: six digit glyphs written to the text buffer, WORK_PTR_LO decremented by 3, loc_2a wrapped,
 * and the advanced cursor stored back to m.regs.x (also returned).
 *
 * Grounding: [seen].
 */
export function buildTextBufferDigitString(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_2a] = 0x02; // pass counter, 2 down to 0
  let carry = true;
  for (;;) {
    const ptr = mem8[WORK_PTR_LO] | (mem8[WORK_PTR_HI] << 8);
    const glyph = mem8[u16(ptr)];
    // High nibble first; the writer's carry-out is unchanged only on a zero nibble.
    const hi = glyph >> 4;
    x = writeNibbleGlyphToTextBuffer(m, hi, x, carry);
    carry = hi === 0 ? carry : false;
    // On the final pass the carry is forced clear before the low nibble.
    if (mem8[loc_2a] === 0) carry = false;
    x = writeNibbleGlyphToTextBuffer(m, glyph, x, carry);
    carry = (glyph & 0x0f) === 0 ? carry : false;
    mem8[WORK_PTR_LO] = u8(mem8[WORK_PTR_LO] - 1);
    mem8[loc_2a] = u8(mem8[loc_2a] - 1);
    if (mem8[loc_2a] >= 0x80) break;
  }
  return (m.regs.x = x);
}
