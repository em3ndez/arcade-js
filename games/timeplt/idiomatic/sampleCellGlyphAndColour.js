// SPDX-License-Identifier: GPL-3.0-only
/** sampleCellGlyphAndColour — copy one character cell's glyph byte and its colour byte into a two-byte record.
 * The two planes hold the same grid at the same offset and are told apart by a single address
 * bit, so one pointer reaches both. The cell is left alone. LIVE-OUT: memory, plus the pointer
 * left on the colour plane, the record cursor stepped past the pair, and the colour byte in hand. */

import { u16 } from "../../../core/int.js";

const GLYPH_PLANE_BIT = 0x400;

export function sampleCellGlyphAndColour(m, cell = m.regs.hl, record = m.regs.de) {
  const { mem8 } = m;
  const colourCell = cell & ~GLYPH_PLANE_BIT;
  const next = u16(record + 1);
  mem8[record] = mem8[cell];
  const colour = mem8[colourCell];
  mem8[next] = colour;
  // Leave the pointer on the colour plane, the record cursor past the pair, and the colour in hand.
  return [(m.regs.hl = colourCell), (m.regs.de = next), (m.regs.a = colour)];
}
