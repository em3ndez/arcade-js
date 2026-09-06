// SPDX-License-Identifier: GPL-3.0-only
// Active-slot draw handler + the slot-loop epilogue. Map the slot's packed coordinate (A) to its
// tilemap-VRAM cell, fold the loop counter into a tile variant, and stamp the glyph / 2x2 block; then
// restore the slot pointer and stride/count saved across the register-clobbering subcalls, advance the
// pointer's low byte by the stride, and loop for the next of the six slots -- or return once the counter
// reaches zero. The layer never pushes, so the walk head forwards the pointer (HL) and stride/count (BC)
// here as savedHl / savedBc; omitted (isolated tests, the born-live entry) they are popped from the stack.
import { mapPackedCoordToVram } from "./mapPackedCoordToVram.js";
import { computeTileVariantFromTimer } from "./computeTileVariantFromTimer.js";
import { drawTileGlyphOrBlock } from "./drawTileGlyphOrBlock.js";
import { loc_207d } from "./loc_207d.js";

export function loc_2089(m, savedHl, savedBc, coord = m.regs.a) {
  mapPackedCoordToVram(m, coord);           // coord -> HL = VRAM cell, A = coord bits 6..5, carry
  computeTileVariantFromTimer(m, coord, 0); // fold the coord into the 2-bit tile variant (into B)
  drawTileGlyphOrBlock(m);                  // stamp the glyph / 2x2 block

  // Restore the saved loop state, advance the pointer's low byte by the stride, and spend one slot (djnz).
  const slotPtr = savedHl === undefined ? m.pop16() : savedHl;
  const strideCount = savedBc === undefined ? m.pop16() : savedBc;
  const stride = strideCount & 0xff;
  const count = (strideCount >> 8) & 0xff;
  const advancedLow = (slotPtr + stride) & 0xff;
  const remaining = (count - 1) & 0xff;
  const advancedPtr = ((slotPtr >> 8) << 8) | advancedLow;
  const strideCountOut = (remaining << 8) | stride;

  // Live-outs HL / A / BC ride the return; loop for the next slot, else return.
  return (m.regs.hl = advancedPtr, m.regs.a = advancedLow, m.regs.bc = strideCountOut,
    remaining !== 0 ? loc_207d(m) : m.ret());
}
