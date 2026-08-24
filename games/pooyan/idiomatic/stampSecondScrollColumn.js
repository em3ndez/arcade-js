// SPDX-License-Identifier: GPL-3.0-only
import { WORKER_COLUMN_VRAM } from "./names.js";
/**
 * stampSecondScrollColumn — stamp the three tiles of the second scroll column, top to bottom.
 *
 * Seeds the column's top cell with tile 0x01, then strides one tilemap row up each step, writing
 * the two body tiles 0x25 then 0x20. Fixed addresses/values — no input registers.
 *
 * LIVE-OUT: memory only — the three column cells; callers read no register back.
 */
const ROW_STRIDE = 32; //  one tilemap row
const TOP_TILE = 0x01; //  tile stamped at the column top
const MID_TILE = 0x25; //  body tile one row up
const BOT_TILE = 0x20; //  body tile two rows up

export function stampSecondScrollColumn(m) {
  const { mem8 } = m;
  mem8[WORKER_COLUMN_VRAM] = TOP_TILE;
  mem8[WORKER_COLUMN_VRAM - ROW_STRIDE] = MID_TILE;
  mem8[WORKER_COLUMN_VRAM - 2 * ROW_STRIDE] = BOT_TILE;
}
