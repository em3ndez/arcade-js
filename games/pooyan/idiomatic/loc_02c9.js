// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_02b9 } from "./loc_02b9.js";
import { loc_0010 } from "./loc_0010.js";
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";
/**
 * loc_02c9 — clear the board-init RAM, then blank one tilemap row and step the row counter.
 *
 * First zeroes the sprite/actor RAM regions. Then, at the 16-bit fill cursor, it blanks the
 * visible cells of one row, walks the cursor a full row forward (the visible run plus the short
 * remainder), stores it back, and decrements the row counter.
 *
 * LIVE-OUT: the Z flag = the row counter reached zero; every caller returns-if-not-zero right
 * after this, so Z is the only consumed result.
 */

const TILE_BLANK = 0x10; // the blank/erase tile
const ROW_WIDTH = 0x20; // tilemap row pitch
const VISIBLE_TILES = 0x1d; // blanked cells per row (the rest is the row remainder)

export function loc_02c9(m) {
  loc_02b9(m); // zero the sprite/actor RAM regions
  const { mem8, mem16 } = m;
  const afterFill = loc_0010(m, mem16[TILE_FILL_PTR], TILE_BLANK, VISIBLE_TILES);
  mem16[TILE_FILL_PTR] = u16(afterFill + (ROW_WIDTH - VISIBLE_TILES));
  const remaining = (mem8[FILL_ROW_COUNTER] - 1) & 0xff;
  mem8[FILL_ROW_COUNTER] = remaining;
  return (m.regs.fZ = remaining === 0); // Z live-out: callers return-if-not-zero until the fill drains
}
