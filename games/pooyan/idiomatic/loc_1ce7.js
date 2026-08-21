// SPDX-License-Identifier: GPL-3.0-only
import { paintColumnBodyTilesUp } from "./paintColumnBodyTilesUp.js";
import { COLUMN_CAP_VRAM } from "./names.js";
/**
 * Stamp a three-cell vertical tilemap column: write the cap tile at the top cell, then paint
 * the mid and base body tiles one row up each.
 *
 * LIVE-OUT: memory only (the three tiles); the advanced pointer is not read back.
 */

const TILE_CAP = 0x02; // the column's top cap tile

export function loc_1ce7(m) {
  const { mem8 } = m;
  mem8[COLUMN_CAP_VRAM] = TILE_CAP;
  return paintColumnBodyTilesUp(m, COLUMN_CAP_VRAM);
}
