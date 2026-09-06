// SPDX-License-Identifier: GPL-3.0-only
// Map a packed coordinate to its VRAM cell, then stamp there: coord bit 4 set draws a 2x2 tile block,
// clear draws a vertical tile pair.
import { mapPackedCoordToVram } from "./mapPackedCoordToVram.js";
import { drawFixedTileBlock2x2 } from "./drawFixedTileBlock2x2.js";
import { drawFixedTilePairVertical } from "./drawFixedTilePairVertical.js";

export function loc_205e(m, coord = m.regs.a) {
  const cell = mapPackedCoordToVram(m, coord);
  // The mapper's carry live-out is coord bit 4.
  if ((coord >> 4) & 1) return drawFixedTileBlock2x2(m, cell);
  return drawFixedTilePairVertical(m, cell);
}
