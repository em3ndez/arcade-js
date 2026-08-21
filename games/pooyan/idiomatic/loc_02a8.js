// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { paintColumnBodyTiles } from "./paintColumnBodyTiles.js";
/**
 * loc_02a8 — stamp a vertical tilemap column: the cap tile, then its two body tiles.
 *
 * Writes the cap tile at the start cell, then stamps the mid and base tiles one row stride
 * apart (the body helper), completing a three-tile column.
 *
 * LIVE-OUT: memory only — the three column cells. The returned advanced pointer is
 * idiomatic-only (the sole caller reloads its own pointer right after), not load-bearing.
 */

const TILE_CAP = 0x01;

export function loc_02a8(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;
  mem8[start] = TILE_CAP;
  return u16(paintColumnBodyTiles(m, start, stride));
}
