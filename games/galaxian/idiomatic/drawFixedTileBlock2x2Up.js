// SPDX-License-Identifier: GPL-3.0-only
// Draw a 2x2 tile block upward from the pointer using the fixed decorative tile seed.
import { drawTileBlock2x2Up } from "./drawTileBlock2x2Up.js";

const TILE_SEED = 46;

export function drawFixedTileBlock2x2Up(m, dst = m.regs.hl) {
  return drawTileBlock2x2Up(m, TILE_SEED, dst);
}
