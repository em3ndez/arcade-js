// SPDX-License-Identifier: GPL-3.0-only
// drawFixedTileFigureAtPackedCoord -- ROM 0x205e [seen]. Display-list channel-1 handler (jump table 0x203d);
// the unanimated sibling of channel-0's drawAnimatedTileFigureAtPackedCoord (0x2055). Stamps a fixed
// 0x2c-family figure at the argument coordinate's VRAM cell -- a 2x2 tile block or a vertical tile pair.
// Map a packed coordinate to its VRAM cell, then stamp there: coord bit 4 set draws a 2x2 tile block,
// clear draws a vertical tile pair.
import { mapPackedCoordToVram } from "./mapPackedCoordToVram.js";
import { drawFixedTileBlock2x2 } from "./drawFixedTileBlock2x2.js";
import { drawFixedTilePairVertical } from "./drawFixedTilePairVertical.js";

export function drawFixedTileFigureAtPackedCoord(m, coord = m.regs.a) {
  // Map the packed coordinate to its page-0x50 tilemap cell (HL live-out), reused as the stamp destination.
  const cell = mapPackedCoordToVram(m, coord);
  // The mapper's carry live-out is coord bit 4.
  // Bit 4 selects the figure shape: set -> a 2x2 tile block, clear -> a vertical (double-height) tile pair.
  if ((coord >> 4) & 1) return drawFixedTileBlock2x2(m, cell);
  return drawFixedTilePairVertical(m, cell);
}
