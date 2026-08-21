// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0010 } from "./loc_0010.js";
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";
/**
 * loc_02ce — fill one row of the row-by-row tilemap fill and step the row counter.
 *
 * Blanks `count` cells (the incoming loop counter) from the fill cursor, advances the cursor
 * by exactly one row for any `count` (the fill moves it `count` forward, then the remainder of
 * a row is added), stores it back, and decrements the row counter.
 *
 * LIVE-OUT: the Z flag = row counter reached zero; the driver loops until it drains.
 */

const TILE_BLANK = 0x10;
const ROW_WIDTH = 0x20;

export function loc_02ce(m, count = m.regs.b) {
  const { mem8, mem16 } = m;
  const afterFill = loc_0010(m, mem16[TILE_FILL_PTR], TILE_BLANK, count);
  const rowAddend = (ROW_WIDTH - count) & 0xff;
  mem16[TILE_FILL_PTR] = u16(afterFill + rowAddend);
  const remaining = (mem8[FILL_ROW_COUNTER] - 1) & 0xff;
  mem8[FILL_ROW_COUNTER] = remaining;
  return (m.regs.fZ = remaining === 0);
}
