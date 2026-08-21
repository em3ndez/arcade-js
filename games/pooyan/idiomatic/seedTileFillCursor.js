// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedTileFillCursor — arm the row-by-row tile fill: point the write cursor and set the row count.
 *
 * Stores the caller's pointer as the 16-bit TILE_FILL_PTR write cursor and seeds
 * FILL_ROW_COUNTER to 0x20; the fill loop then walks both down, one row per pass. A leaf; calls nothing.
 *
 * LIVE-OUT: A = 0x20 (the seeded row count), which the caller kicks the watchdog with right
 * after the call; plus the two cells written. Wiring must write A back.
 */
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";

const FILL_ROWS = 0x20; // 32 tilemap rows to fill

export function seedTileFillCursor(m, ptr = m.regs.hl) {
  const { mem8, mem16 } = m;
  mem16[TILE_FILL_PTR] = ptr;
  mem8[FILL_ROW_COUNTER] = FILL_ROWS;
  return FILL_ROWS; // A live-out
}
