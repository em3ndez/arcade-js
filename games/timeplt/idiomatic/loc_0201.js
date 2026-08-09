// SPDX-License-Identifier: GPL-3.0-only
/** loc_0201 — draw one interpolated run of pen cells, then set up the next run. From the pen's
 * current row and column (each a fraction:integer pair) take a signed per-step increment of
 * (target - current) times sixteen with only the high byte kept, then stamp the pen glyph cell by
 * cell, advancing both positions each step, until the stamped cell reaches the run's end cell.
 * Then bump the run index, read the next run's row and column out of the word table, reseat the
 * pen there with the fractions cleared, and leave the Z flag set when the new row integer is zero.
 * LIVE-OUT: the stamped cells and the pen state; the Z flag (new row integer == 0), which callers
 * branch on with a conditional return. */

import { plotPenCell } from "./plotPenCell.js";
import { fetchTableWord } from "./fetchTableWord.js";

const ROW_POS = 0xa9e3;
const COL_POS = 0xa9e5;
const ROW_STEP = 0xa9e7;
const COL_STEP = 0xa9e9;
const RUN_INDEX = 0xa9e2;
const ROW_TARGET = 0x32f5;
const COL_TARGET = 0x0b45;
const END_CELL = 0x14b2;
const RUN_TABLE = 0x0290;

/** (target - current) times sixteen, keeping only the signed high byte: the per-step increment. */
function stepToward(target, current) {
  const delta = (target - current) & 0xffff;
  const highByte = (delta >> 12) & 1 ? 0xff00 : 0x0000;
  return (highByte | ((delta >> 4) & 0xff)) & 0xffff;
}

export function loc_0201(m) {
  const { regs, mem8, mem16 } = m;

  plotPenCell(m);
  mem16[ROW_STEP] = stepToward(mem16[ROW_TARGET], mem16[ROW_POS]);
  mem16[COL_STEP] = stepToward(mem16[COL_TARGET], mem16[COL_POS]);

  do {
    mem16[ROW_POS] = mem16[ROW_POS] + mem16[ROW_STEP];
    mem16[COL_POS] = mem16[COL_POS] + mem16[COL_STEP];
    plotPenCell(m);
  } while (regs.hl !== mem16[END_CELL]);

  mem8[RUN_INDEX] = mem8[RUN_INDEX] + 1;
  regs.a = mem8[RUN_INDEX];
  regs.hl = RUN_TABLE;
  fetchTableWord(m);

  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.e;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.d;

  regs.a = regs.e;
  regs.and(regs.a);
  m.ret(10);
}
