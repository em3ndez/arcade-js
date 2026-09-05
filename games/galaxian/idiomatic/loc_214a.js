// SPDX-License-Identifier: GPL-3.0-only
// Swap DE/HL, then stamp a 2x2 tile block at that pointer from the seed tile. The pointer that arrived in
// DE becomes the draw destination; the old HL is handed back in DE.
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";

export function loc_214a(m, tile = m.regs.a, dst = m.regs.de, swapOut = m.regs.hl) {
  // ex de,hl hands the old HL back in DE, then the block draws at the pointer that arrived in DE.
  return (m.regs.de = swapOut, drawTileBlock2x2(m, tile, dst));
}
