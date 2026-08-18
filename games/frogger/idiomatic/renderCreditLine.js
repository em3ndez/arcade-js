// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderCreditLine — redraw the credit line: on the first call, fill the credit column with a clear
 * tile and latch a one-time init flag; every call then stamps the credit label and prints the credit
 * count as packed-BCD. LIVE-OUT: memory + HL/DE advanced for the caller.
 */
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";
import {
  CREDIT_BCD, OBJRAM_COL3F_ATTR_SHADOW, CREDIT_COLUMN_CLEAR_LATCH, CREDIT_LABEL_STRIP,
  CREDIT_COLUMN_TOP_VRAM, CREDIT_LABEL_DST, CREDIT_COUNT_DST,
} from "./names.js";

const CLEAR_TILE = 0x10;
const COLUMN_CELLS = 0x20;
const ROW_STEP = 32; // one 32-cell tilemap row
const LABEL_LEN = 0x06;

export function renderCreditLine(m) {
  const { mem8 } = m;

  if (mem8[CREDIT_COLUMN_CLEAR_LATCH] === 0) {
    mem8[CREDIT_COLUMN_CLEAR_LATCH] = 1;
    let cell = CREDIT_COLUMN_TOP_VRAM;
    for (let n = COLUMN_CELLS; n !== 0; n--) {
      mem8[cell] = CLEAR_TILE;
      cell = cell + ROW_STEP;
    }
  }

  copyRunUpTileColumn(m, CREDIT_LABEL_DST, CREDIT_LABEL_STRIP, LABEL_LEN);

  mem8[OBJRAM_COL3F_ATTR_SHADOW] = 1;
  return writePackedBcdByte(m, mem8[CREDIT_BCD], CREDIT_COUNT_DST);
}
