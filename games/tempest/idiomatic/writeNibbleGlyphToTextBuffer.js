// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { VEC_GLYPH_BUFFER, NIBBLE_GLYPH_TABLE } from "./names.js";

/**
 * writeNibbleGlyphToTextBuffer — emit one hex-digit glyph into the vector text buffer. ROM 0xa9fc.
 *
 * Role in the machine: Tempest draws its on-screen text (scores, level numbers, messages) as vector
 * strokes. This is the digit-plotting primitive: given a 4-bit value in A it looks up the matching stroke
 * byte in the ROM glyph table loc_31e4 and appends it to the growing text buffer at cursor loc_2f60+x,
 * then bumps the cursor so the next call lands in the following slot. Callers feed it nibbles of a BCD /
 * hex number one at a time to spell out a field.
 *
 * Behavior: take A's low nibble. A zero nibble arriving with carry set selects table entry 0 (the leading-
 * zero / blank form); any other case selects entry nibble+1. The chosen entry index is doubled and masked
 * to a byte ((y<<1)&0xff) to address the table, and the fetched stroke byte is stored at loc_2f60+x. The
 * cursor x is then advanced by two (each buffered glyph occupies two bytes) and returned.
 *
 * Live-out: one stroke byte written to the text buffer at loc_2f60+x, and the X register advanced by two
 * (the next write cursor). Grounding: [seen].
 */
export function writeNibbleGlyphToTextBuffer(m, a = m.regs.a, x = m.regs.x, carryIn = m.regs.fC) {
  const { mem8 } = m;
  const nibble = a & 0x0f;
  // A zero nibble with carry set indexes entry 0; otherwise step one past the nibble.
  const y = nibble === 0 && carryIn ? 0 : nibble + 1;
  // Double-and-mask the entry index to address the ROM stroke table; store the glyph at the cursor.
  mem8[u16(VEC_GLYPH_BUFFER + x)] = mem8[u16(NIBBLE_GLYPH_TABLE + ((y << 1) & 0xff))];
  // Advance the write cursor by two (one glyph = two buffer bytes) and hand it back in X.
  return (m.regs.x = u8(x + 2));
}
