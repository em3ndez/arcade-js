// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { HIGH_SCORE_TABLE, HIGH_SCORE_TABLE_VRAM } from "./names.js";
import { loc_05b2 } from "./loc_05b2.js";
import { splitBcdByte } from "./splitBcdByte.js";
import { loc_0439 } from "./loc_0439.js";
import { renderPanelFromTable } from "./renderPanelFromTable.js";
/**
 * loc_03e9 — paint the HUD / score panels for the attract screen.
 *
 * Draws eleven selector-indexed character fields, then renders the ten-entry high-score
 * table as stacked BCD digit pairs (each source byte split into low then high nibble a row
 * apart, the third pair's leading zero suppressed, the column re-based two cells right per
 * row), and finally repaints the digit panel and the status panel.
 *
 * LIVE-OUT: memory only — the painted tilemap. This is a table-dispatched screen handler;
 * no caller consumes a register result.
 */

const FIELD_FIRST = 0x1a; // first field selector; eleven consecutive fields are drawn
const FIELD_COUNT = 0x0b;
const ROW_COUNT = 0x0a; //   ten high-score entries
const ROW_STRIDE = 0x20; //  one tilemap row down
const NEXT_ROW_DELTA = -0x9e; // re-base the column two cells right for the next row (u16-wrapped)

export function loc_03e9(m) {
  const { mem8 } = m;

  for (let i = 0; i < FIELD_COUNT; i++) loc_05b2(m, FIELD_FIRST + i);

  let cursor = HIGH_SCORE_TABLE_VRAM;
  let rec = HIGH_SCORE_TABLE;
  for (let row = 0; row < ROW_COUNT; row++) {
    const [high1, afterLow1] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    mem8[afterLow1] = high1;
    cursor = u16(afterLow1 + ROW_STRIDE);
    rec = u16(rec + 1);

    const [high2, afterLow2] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    mem8[afterLow2] = high2;
    cursor = u16(afterLow2 + ROW_STRIDE);
    rec = u16(rec + 1);

    const [high3, afterLow3, high3IsZero] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    if (!high3IsZero) mem8[afterLow3] = high3; // leading-zero suppress on the top digit
    cursor = u16(afterLow3 + NEXT_ROW_DELTA);
    rec = u16(rec + 1);
  }

  loc_0439(m);
  renderPanelFromTable(m);
}
