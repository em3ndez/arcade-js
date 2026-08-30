// SPDX-License-Identifier: GPL-3.0-only
import { WORKER_COLUMN_VRAM } from "./names.js";
/**
 * stampSecondScrollColumn — paint the three tiles of the second scroll column into video
 * RAM, top cell first then upward.  ROM 0x1d0d (a mid-routine entry that then merges into a
 * shared sprite-slot tail at 0x1cec).
 *
 * The playfield's scrolling background is laid down one short vertical column at a time by a
 * per-frame worker.  This routine draws one such column — the "second" one — as a fixed
 * three-tile stack: a top cell and two body cells directly above it.  The tile map is a
 * 32-cell-wide grid whose rows run upward in DECREASING address, so each successive cell is
 * one row (32 = 0x20 bytes) LOWER in memory than the last.  Every address and tile value is
 * baked into the ROM here; nothing is read from registers.  [seen]
 *
 * The base cell is WORKER_COLUMN_VRAM (0x8740), the video-RAM origin of this column.  From
 * there the two body tiles land at 0x8720 and 0x8700.  The stamped tiles are fixed graphics
 * codes: 0x01 caps the column, and 0x25 / 0x20 are the two body tiles the worker also uses
 * when refreshing this column each frame.
 *
 * LIVE-OUT: memory only — the three tile-map cells at 0x8740, 0x8720, 0x8700.  No register
 * is left for the caller to read back.
 */
const ROW_STRIDE = 32; //  one tilemap row
const TOP_TILE = 0x01; //  tile stamped at the column top
const MID_TILE = 0x25; //  body tile one row up
const BOT_TILE = 0x20; //  body tile two rows up

export function stampSecondScrollColumn(m) {
  const { mem8 } = m;

  // Seed the column's top cell (WORKER_COLUMN_VRAM = 0x8740) with the cap tile 0x01.
  mem8[WORKER_COLUMN_VRAM] = TOP_TILE;

  // Step one tile-map row UP — one row is 0x20 bytes LOWER in memory — to 0x8720 and write
  // the first body tile 0x25.
  mem8[WORKER_COLUMN_VRAM - ROW_STRIDE] = MID_TILE;

  // Step one more row up, to 0x8700, and write the second body tile 0x20.
  mem8[WORKER_COLUMN_VRAM - 2 * ROW_STRIDE] = BOT_TILE;
}
