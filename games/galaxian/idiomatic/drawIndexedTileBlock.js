// SPDX-License-Identifier: GPL-3.0-only
// Look up a 2x2 tile-block code in the block table by `index`, then stamp that block at the pending
// destination pointer.
import { TILE_BLOCK_TABLE } from "./names.js";
import { fetchIndexedTableByte } from "./fetchIndexedTableByte.js";
import { drawTileBlock2x2AtDe } from "./drawTileBlock2x2AtDe.js";

export function drawIndexedTileBlock(m, index = m.regs.a) {
  const tile = fetchIndexedTableByte(m, index, TILE_BLOCK_TABLE);
  return drawTileBlock2x2AtDe(m, tile);
}
