// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * paintColumnBodyTiles — stamp the two body tiles of a vertical tilemap column.
 *
 * Advances one row stride and writes the mid tile, advances another and writes the base
 * tile — the lower two cells of a three-tile column (the caller stamps the cap). Two cells
 * written, nothing read; a leaf that calls nothing.
 *
 * LIVE-OUT: memory (the two tiles); returns the advanced pointer (start + 2*stride, 16-bit).
 */

const TILE_MID = 0x25; //  the column's middle body tile
const TILE_BASE = 0x20; // the column's base tile

export function paintColumnBodyTiles(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;
  const mid = start + stride;
  mem8[mid] = TILE_MID;
  const base = mid + stride;
  mem8[base] = TILE_BASE;
  return u16(base);
}
