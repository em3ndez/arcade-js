// SPDX-License-Identifier: GPL-3.0-only
// Tile-draw dispatcher. On carry in, swap DE/HL and stamp a 2x2 block selected by B at that pointer.
// Otherwise fetch the tile code for B from the index table and paint it as a double-height glyph at the
// incoming HL -- the swap dance only stashes HL across the pointer-clobbering fetch, so the destination
// is the incoming HL.
import { loc_2157 } from "./names.js";
import { drawSelectedTileBlockOrFallback } from "./drawSelectedTileBlockOrFallback.js";
import { fetchIndexedTableByte } from "./fetchIndexedTableByte.js";
import { drawDoubleHeightTile } from "./drawDoubleHeightTile.js";

export function loc_2131(m, carry = m.regs.fC, index = m.regs.b, hl = m.regs.hl, de = m.regs.de) {
  if (carry) return (m.regs.hl = de, m.regs.de = hl, drawSelectedTileBlockOrFallback(m, index));

  const dest = hl;
  const tile = fetchIndexedTableByte(m, index, loc_2157);
  return drawDoubleHeightTile(m, tile, dest);
}
