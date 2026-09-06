// SPDX-License-Identifier: GPL-3.0-only
// Unpacks a text-draw descriptor (source word, destination word, then a count byte) at the given pointer
// and paints that many characters up a tilemap column, each source byte mapped to a tile code.
import { drawTextColumn } from "./drawTextColumn.js";

const COLUMN_UP_STRIDE = 65504; // -32 as an unsigned 16-bit step: one tilemap row up per character

export function drawTextColumnFromDescriptor(m, record = m.regs.hl) {
  const { mem8 } = m;

  const source = mem8[record] | (mem8[record + 1] << 8);
  const dest = mem8[record + 2] | (mem8[record + 3] << 8);
  const count = mem8[record + 4];

  drawTextColumn(m, count, source, dest, COLUMN_UP_STRIDE);
}
