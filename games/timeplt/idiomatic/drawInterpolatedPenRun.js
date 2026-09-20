// SPDX-License-Identifier: GPL-3.0-only
/** drawInterpolatedPenRun — draw one interpolated run of pen cells, then set up the next run. From the pen's
 * current row and column (each a fraction:integer pair) take a signed per-step increment of
 * (target - current) times sixteen with only the high byte kept, then stamp the pen glyph cell by
 * cell, advancing both positions each step, until the stamped cell reaches the run's end cell.
 * Then bump the run index, read the next run's row and column out of the word table, reseat the
 * pen there with the fractions cleared, and leave the Z flag set when the new row integer is zero.
 * LIVE-OUT: the stamped cells and the pen state; the Z flag (new row integer == 0), which callers
 * branch on with a conditional return. */

import { u16 } from "../../../core/int.js";
import { plotPenCell } from "./plotPenCell.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { PEN_COLUMN_POS, PEN_COLUMN_STEP, PEN_ROUTE_LEG, PEN_ROW_POS, PEN_ROW_STEP, PEN_ROUTE_TABLE, PEN_COLUMN_TARGET, PEN_RUN_END_CELL, PEN_ROW_TARGET } from "./names.js";

/** (target - current) times sixteen, keeping only the signed high byte: the per-step increment. */
function stepToward(target, current) {
  const delta = u16(target - current);
  const highByte = (delta >> 12) & 1 ? 0xff00 : 0x0000;
  return u16(highByte | ((delta >> 4) & 0xff));
}

export function drawInterpolatedPenRun(m) {
  const { regs, mem8, mem16 } = m;

  plotPenCell(m);
  mem16[PEN_ROW_STEP] = stepToward(mem16[PEN_ROW_TARGET], mem16[PEN_ROW_POS]);
  mem16[PEN_COLUMN_STEP] = stepToward(mem16[PEN_COLUMN_TARGET], mem16[PEN_COLUMN_POS]);

  let cell;
  do {
    mem16[PEN_ROW_POS] = mem16[PEN_ROW_POS] + mem16[PEN_ROW_STEP];
    mem16[PEN_COLUMN_POS] = mem16[PEN_COLUMN_POS] + mem16[PEN_COLUMN_STEP];
    cell = plotPenCell(m)[0];
  } while (cell !== mem16[PEN_RUN_END_CELL]);

  mem8[PEN_ROUTE_LEG] = mem8[PEN_ROUTE_LEG] + 1;
  regs.hl = PEN_ROUTE_TABLE; // table base for fetchTableWord's offsetAddress (no hl param there)
  const word = fetchTableWord(m, mem8[PEN_ROUTE_LEG]);

  mem8[PEN_ROW_POS] = 0;
  mem8[PEN_ROW_POS + 1] = word & 0xff;
  mem8[PEN_COLUMN_POS] = 0;
  mem8[PEN_COLUMN_POS + 1] = word >> 8;

  regs.a = word & 0xff; // sets the Z-flag live-out callers branch on
  regs.and(regs.a);
  m.ret(10);
}
