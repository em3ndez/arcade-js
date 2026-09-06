// SPDX-License-Identifier: GPL-3.0-only
// Animated object-grid cell draw + the loop epilogue. Map the cell's packed coordinate (A) to its
// tilemap-VRAM cell, fold the frame counter into a tile variant, and stamp the glyph / 2x2 block; then
// restore the grid pointer and stride/count saved across the register-clobbering subcalls, advance the
// pointer's low byte by the row stride, and loop for the next of the six rows -- or return once the counter
// reaches zero. The layer never pushes, so the walk head forwards the pointer (HL) and stride/count (BC)
// here as savedHl / savedBc; omitted (isolated tests, the born-live entry) they are popped from the stack.
import { mapPackedCoordToVram } from "./mapPackedCoordToVram.js";
import { computeTileVariantFromTimer } from "./computeTileVariantFromTimer.js";
import { drawTileGlyphOrBlock } from "./drawTileGlyphOrBlock.js";
import { routeObjectGridCellDraw } from "./routeObjectGridCellDraw.js";

export function drawAnimatedObjectGridCellAndAdvance(m, savedHl, savedBc, coord = m.regs.a) {
  mapPackedCoordToVram(m, coord);           // coord -> HL = VRAM cell, A = coord bits 6..5, carry
  computeTileVariantFromTimer(m, coord, 0); // fold the coord into the 2-bit tile variant (into B)
  drawTileGlyphOrBlock(m);                  // stamp the glyph / 2x2 block

  // Restore the saved loop state, advance the pointer's low byte by the row stride, and spend one row (djnz).
  const slotPtr = savedHl === undefined ? m.pop16() : savedHl;
  const strideCount = savedBc === undefined ? m.pop16() : savedBc;
  const stride = strideCount & 0xff;
  const count = (strideCount >> 8) & 0xff;
  const advancedLow = (slotPtr + stride) & 0xff;
  const remaining = (count - 1) & 0xff;
  const advancedPtr = ((slotPtr >> 8) << 8) | advancedLow;
  const strideCountOut = (remaining << 8) | stride;

  // Live-outs HL / A / BC ride the return; loop for the next row, else return.
  return (m.regs.hl = advancedPtr, m.regs.a = advancedLow, m.regs.bc = strideCountOut,
    remaining !== 0 ? routeObjectGridCellDraw(m) : m.ret());
}
