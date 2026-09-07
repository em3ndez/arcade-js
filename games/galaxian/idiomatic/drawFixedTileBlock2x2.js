// SPDX-License-Identifier: GPL-3.0-only
// drawFixedTileBlock2x2 -- ROM 0x2583 [seen]. The block form of the fixed 0x2c (44) glyph family: stamps a
// 2x2 tile block at the HL destination laying the four consecutive tile codes 0x2c..0x2f -- top pair then
// bottom pair one tilemap row down -- via drawTileBlock2x2 (0x2585), which preserves DE.
// Lay a 2x2 tile block at the destination, seeded with the first of its four consecutive tile codes.
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";

const FIRST_TILE = 44; // first of the four block tile codes

export function drawFixedTileBlock2x2(m, dst = m.regs.hl) {
  // Hand the fixed seed and destination to the generic 2x2 block writer; it lays 0x2c..0x2f and returns.
  return drawTileBlock2x2(m, FIRST_TILE, dst);
}
