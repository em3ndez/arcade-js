// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderCreditLine — redraw the credit line: on the first call, fill the credit column with a clear
 * tile and latch a one-time init flag; every call then stamps the credit label and prints the credit
 * count as packed-BCD. LIVE-OUT: memory + HL/DE advanced for the caller.
 */
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";
import { CREDIT_BCD, loc_803f, loc_83b4, loc_2f68 } from "./names.js";

const COLUMN_TOP = 0xa81f;
const CLEAR_TILE = 0x10;
const COLUMN_CELLS = 0x20;
const ROW_STEP = 0x0020; // one 32-cell tilemap row
const LABEL_DST = 0xa97f;
const LABEL_LEN = 0x06;
const COUNT_DST = 0xa89f;

export function renderCreditLine(m) {
  const { regs, mem8 } = m;

  if (mem8[loc_83b4] === 0) {
    mem8[loc_83b4] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS; n !== 0; n--) {
      mem8[cell] = CLEAR_TILE;
      cell = (cell + ROW_STEP) & 0xffff;
    }
  }

  copyRunUpTileColumn(m, LABEL_DST, loc_2f68, LABEL_LEN);

  mem8[loc_803f] = 1;
  regs.hl = COUNT_DST;
  regs.a = mem8[CREDIT_BCD];
  return writePackedBcdByte(m);
}
