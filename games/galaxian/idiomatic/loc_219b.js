// SPDX-License-Identifier: GPL-3.0-only
// Blank a 4x4 tile block, then draw a 2x2 tile block (seed tile 96) over it.
// Returns the advanced tile/pointer from the 2x2 draw.
import { blankTileBlock4x4 } from "./blankTileBlock4x4.js";
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";
import { loc_51fc } from "./names.js";

const SEED_TILE = 96;

export function loc_219b(m) {
  blankTileBlock4x4(m);
  return drawTileBlock2x2(m, SEED_TILE, loc_51fc);
}
