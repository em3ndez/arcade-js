// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedTileFillCursor — arm the row-by-row tilemap fill before the fill loop runs.
 *
 * ROM 0x02e6-0x02ee. Grounding: [seen].
 *
 * The screen's background is a grid of tiles held in video RAM. To wipe or repaint the whole
 * grid the machine runs a fill loop that walks a write cursor down the tilemap one row at a
 * time. That loop needs two pieces of state set up first, and that setup is all this leaf does:
 *   - the WRITE CURSOR — where the next tile write lands — stored as a 16-bit pointer in
 *     TILE_FILL_PTR, taken from the pointer the caller hands in;
 *   - the ROW COUNTER — how many rows remain — stored in FILL_ROW_COUNTER, seeded to 0x20 (32),
 *     the number of tilemap rows on this hardware.
 * The fill loop then walks both down together, decrementing the counter and advancing the cursor
 * once per row until the counter hits zero. A pure leaf; it calls nothing.
 *
 * LIVE-OUT: A = 0x20 (the seeded row count). The machine leaves the row count in A on the way
 * out, and the caller uses it immediately to kick the hardware watchdog. Also live: the two RAM
 * cells written. Wiring must carry A back to the caller.
 */
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";

const FILL_ROWS = 0x20; // 32 tilemap rows to fill — the full height of the tile grid

export function seedTileFillCursor(m, ptr = m.regs.hl) {
  const { mem8, mem16 } = m;

  // Point the fill loop's write cursor at the caller's start address (16-bit, low byte first
  // in RAM as the hardware stores pointers).
  mem16[TILE_FILL_PTR] = ptr;

  // Seed the remaining-row counter to the full grid height so the loop covers every row.
  mem8[FILL_ROW_COUNTER] = FILL_ROWS;

  // Leave the row count in A: the machine returns with it here and the caller feeds it straight
  // into the watchdog kick.
  return (m.regs.a = FILL_ROWS);
}
