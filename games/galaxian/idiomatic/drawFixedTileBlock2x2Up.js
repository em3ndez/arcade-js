// SPDX-License-Identifier: GPL-3.0-only
// drawFixedTileBlock2x2Up -- ROM 0x2591 [seen]. Upward-growing 2x2 tile block seeded from the fixed
// decorative tile code 46 (0x2e) via drawTileBlock2x2Up (0x2593), the upward counterpart of drawTileBlock2x2.
// Used by drawMarkerRow to blank the unused slots of the marker row.
// Draw a 2x2 tile block upward from the pointer using the fixed decorative tile seed.
import { drawTileBlock2x2Up } from "./drawTileBlock2x2Up.js";

const TILE_SEED = 46;

export function drawFixedTileBlock2x2Up(m, dst = m.regs.hl) {
  // Hand the fixed decorative seed and destination to the upward 2x2 block writer.
  return drawTileBlock2x2Up(m, TILE_SEED, dst);
}
