// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PANEL_DIGIT_SOURCE_TABLE, PANEL_DIGIT_VRAM_DEST } from "./names.js";
import { splitBcdByte } from "./splitBcdByte.js";
/**
 * loc_0439 — render ten rows of packed-BCD panel digits into video RAM.
 *
 * Each row draws two source bytes as digit pairs: the first byte's low then high nibble a row
 * apart, a fixed separator tile a row further on, then the second byte's low nibble and (unless
 * its high nibble is zero, leading-zero suppressed) its high nibble. The source pointer skips one
 * byte per row (reads bytes 1 and 2 of every three); the destination re-bases two cells right each
 * row. Reads the source table, writes the panel; the digit split is delegated per nibble pair.
 *
 * LIVE-OUT: memory only — the ten rendered rows. The caller renders the next panel afterward with
 * freshly loaded pointers, so no register survives.
 */

const ROW_STRIDE = 0x20; //         one tilemap row
const NEXT_COLUMN_DELTA = -0x7e; // re-base the cursor two cells right for the next row (u16-wrapped)
const SEPARATOR_TILE = 0x51; //     the fixed tile wedged between the two digit pairs
const ROW_COUNT = 0x0a;

export function loc_0439(m) {
  const { mem8 } = m;
  let src = PANEL_DIGIT_SOURCE_TABLE;
  let dst = PANEL_DIGIT_VRAM_DEST;

  for (let row = 0; row < ROW_COUNT; row++) {
    src = u16(src + 1);
    const [high1, afterLow1] = splitBcdByte(m, src, dst, ROW_STRIDE);
    mem8[afterLow1] = high1; //                    first byte's high nibble, a row on
    let cell = u16(afterLow1 + ROW_STRIDE);
    mem8[cell] = SEPARATOR_TILE;
    cell = u16(cell + ROW_STRIDE);

    src = u16(src + 1);
    const [high2, afterLow2, high2IsZero] = splitBcdByte(m, src, cell, ROW_STRIDE);
    if (!high2IsZero) mem8[afterLow2] = high2; //  second high nibble, leading zero suppressed

    src = u16(src + 1);
    dst = u16(afterLow2 + NEXT_COLUMN_DELTA);
  }
}
