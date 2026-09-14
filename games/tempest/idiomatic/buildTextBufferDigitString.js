// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2a, WORK_PTR_LO, WORK_PTR_HI } from "./names.js";
import { writeNibbleGlyphToTextBuffer } from "./writeNibbleGlyphToTextBuffer.js";

// Emit three source bytes, each as its high then low nibble, through a table
// writer; step the source pointer back one after each byte.
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
