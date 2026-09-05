// SPDX-License-Identifier: GPL-3.0-only
// Lay a 2x2 tile block at the destination, seeded with the first of its four consecutive tile codes.
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";

const FIRST_TILE = 44; // first of the four block tile codes

export function loc_2583(m, dst = m.regs.hl) {
  return drawTileBlock2x2(m, FIRST_TILE, dst);
}
