// SPDX-License-Identifier: GPL-3.0-only

/**
 * mapPackedCoordToVram — turn a packed coordinate byte into a tilemap-VRAM cell address.
 *
 * WHAT IT IS
 *   The single mapping every figure draw runs through. Rather than plain row/column arithmetic it shuffles
 *   the coordinate byte's nibble fields into a page-0x50 cell address: the low nibble is rotated to yield a
 *   two-bit high-address byte (which quarter of the map, 0..3) plus the top two bits of a low seed, and the
 *   high nibble supplies a three-bit field whose complemented running sum forms the low nibble of the
 *   address. The final cell is VRAM_BASE + (high << 8) + low.
 *
 * ROLE IN THE MACHINE
 *   Called by the tile-figure draw handlers (drawFixedTileFigureAtPackedCoord, the animated variant, the
 *   object-grid draw). Beyond the address it hands back two values the callers branch on: coord bits 6..5
 *   in A, and — crucially — coord bit 4 exposed as the carry flag. That carry is the block-versus-glyph
 *   selector: bit 4 set draws a 2x2 tile block, clear draws a single double-height glyph. So the same
 *   coordinate that positions a figure also chooses its shape.
 *
 * ROM 0x20e1.  Grounding: [seen].
 * Live-outs: HL = the cell address; A = coord bits 6..5; carry = coord bit 4.
 */
import { VRAM_BASE } from "./names.js";

export function mapPackedCoordToVram(m, coord = m.regs.a) {
  // Low nibble -> high address byte (0..3) and the top two bits of the low byte, via a right-rotate-by-two.
  const lowNibble = coord & 0x0f;
  const rot = ((lowNibble >> 2) | (lowNibble << 6)) & 0xff; // low nibble rotated right two
  const highByte = rot & 0x03;                              // address high byte (0..3)
  const lowSeed = rot & 0xc0;                               // top two bits of the low byte
  // High nibble -> a three-bit field; its bit 0 rotates out as the carry live-out, the rest is A.
  const field = (coord >> 4) & 0x07;                        // three-bit high-nibble field
  const carry = field & 0x01;                               // bit rotated out -> carry live-out
  const aOut = field >> 1;                                  // rotated field -> A live-out
  // Fold the field into the low nibble as a complemented running sum, add the seed, assemble the address.
  const fold = (~((field >> 1) + field + carry)) & 0x0f;    // complemented running sum, low nibble
  const low = (fold + lowSeed) & 0xff;
  const addr = VRAM_BASE + (highByte << 8) + low;
  return (m.regs.a = aOut, m.regs.fC = carry === 1, m.regs.hl = addr, addr);
}
