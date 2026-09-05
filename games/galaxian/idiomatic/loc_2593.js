// SPDX-License-Identifier: GPL-3.0-only
// Draws a 2x2 tile block upward from the pointer: a top pair (tile, tile+1) at the pointer, then a
// lower-coded bottom pair one tilemap row above. Advances the tile code and pointer; leaves DE unchanged.
import { stampTilePair } from "./stampTilePair.js";

const UP_ROW_STRIDE = 65503; // -33 as an unsigned 16-bit step: after the pair's built-in +1, one row up

export function loc_2593(m, tile = m.regs.a, dst = m.regs.hl) {
  const top = stampTilePair(m, tile, dst, UP_ROW_STRIDE);
  const bottomTile = (top.a - 4) & 0xff; // step the code back four before the upper pair
  return stampTilePair(m, bottomTile, top.hl, UP_ROW_STRIDE);
}
