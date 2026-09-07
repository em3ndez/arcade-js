// SPDX-License-Identifier: GPL-3.0-only
// drawAnimatedTileFigureAtPackedCoord -- ROM 0x2055 [seen]. Display-list channel-0 handler (jump table
// 0x203d, dispatched by decodeDisplayListSlotAndDispatch); the animated counterpart of channel-1's fixed
// drawFixedTileFigureAtPackedCoord (0x205e). The command argument passed in A is a packed VRAM coordinate.
// Draw-dispatch table entry: map the packed coordinate in A to its VRAM cell, bias that same coordinate into
// a timer-animated tile variant, then draw at the cell -- a 2x2 block when the coordinate's bit 4 is set (the
// mapper's carry live-out), a double-height glyph otherwise. The mapper copies the coordinate into B, and the
// variant fold reads B, so the value biased is the coordinate itself. The VRAM base rides in as DE for the
// block path's pointer swap.
import { mapPackedCoordToVram } from "./mapPackedCoordToVram.js";
import { computeTileVariantFromValueAndTimer } from "./computeTileVariantFromValueAndTimer.js";
import { drawTileGlyphOrBlock } from "./drawTileGlyphOrBlock.js";
import { VRAM_BASE } from "./names.js";

export function drawAnimatedTileFigureAtPackedCoord(m, coord = m.regs.a) {
  const cell = mapPackedCoordToVram(m, coord);
  const variant = computeTileVariantFromValueAndTimer(m, coord); // mapper leaves B = coord; the fold biases that
  const drawBlock = ((coord >> 4) & 1) === 1; // mapper carry live-out = coord bit 4
  return drawTileGlyphOrBlock(m, drawBlock, variant, cell, VRAM_BASE);
}
