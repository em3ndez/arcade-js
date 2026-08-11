// SPDX-License-Identifier: GPL-3.0-only
/** drawInterpolatedPenRun — draw one interpolated run of pen cells, then set up the next run. From the pen's
 * current row and column (each a fraction:integer pair) take a signed per-step increment of
 * (target - current) times sixteen with only the high byte kept, then stamp the pen glyph cell by
 * cell, advancing both positions each step, until the stamped cell reaches the run's end cell.
 * Then bump the run index, read the next run's row and column out of the word table, reseat the
 * pen there with the fractions cleared, and leave the Z flag set when the new row integer is zero.
 * LIVE-OUT: the stamped cells and the pen state; the Z flag (new row integer == 0), which callers
 * branch on with a conditional return. */

import { plotPenCell } from "./plotPenCell.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { PEN_COLUMN_POS, PEN_COLUMN_STEP, PEN_ROUTE_LEG, PEN_ROW_POS, PEN_ROW_STEP } from "./names.js";

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

export function drawInterpolatedPenRun(m) {
  const { regs, mem8, mem16 } = m;

  plotPenCell(m);
  mem16[PEN_ROW_STEP] = stepToward(mem16[ROW_TARGET], mem16[PEN_ROW_POS]);
  mem16[PEN_COLUMN_STEP] = stepToward(mem16[COL_TARGET], mem16[PEN_COLUMN_POS]);

  do {
    mem16[PEN_ROW_POS] = mem16[PEN_ROW_POS] + mem16[PEN_ROW_STEP];
    mem16[PEN_COLUMN_POS] = mem16[PEN_COLUMN_POS] + mem16[PEN_COLUMN_STEP];
    plotPenCell(m);
  } while (regs.hl !== mem16[END_CELL]);

  mem8[PEN_ROUTE_LEG] = mem8[PEN_ROUTE_LEG] + 1;
  regs.a = mem8[PEN_ROUTE_LEG];
  regs.hl = RUN_TABLE;
  fetchTableWord(m);

  mem8[PEN_ROW_POS] = 0;
  mem8[PEN_ROW_POS + 1] = regs.e;
  mem8[PEN_COLUMN_POS] = 0;
  mem8[PEN_COLUMN_POS + 1] = regs.d;

  regs.a = regs.e;
  regs.and(regs.a);
  m.ret(10);
}
