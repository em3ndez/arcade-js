// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blankTileColumn — clear a three-cell vertical tilemap column to the blank tile.
 *
 * From a tilemap pointer, writes the blank tile 0x10 into three cells one row stride
 * apart (start, start+stride, start+2*stride), erasing a scrolled column. Stride is
 * the row pitch as a signed 16-bit addend.
 *
 * LIVE-OUT: the advanced pointer (start + 2*stride, 16-bit), returned and chained
 * into the next column, so wiring must write it back.
 */

const TILE_BLANK = 0x10; // the blank/erase tile

export function blankTileColumn(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;
  let cell = start;
  mem8[cell] = TILE_BLANK;
  cell = cell + stride;
  mem8[cell] = TILE_BLANK;
  cell = cell + stride;
  mem8[cell] = TILE_BLANK;
  return u16(cell);
}
