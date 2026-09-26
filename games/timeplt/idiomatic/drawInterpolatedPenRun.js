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
import { F_H, F_PV, F_S, F_Z, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { plotPenCell } from "./plotPenCell.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { PEN_COLUMN_POS, PEN_COLUMN_STEP, PEN_ROUTE_LEG, PEN_ROW_POS, PEN_ROW_STEP, PEN_ROUTE_TABLE, PEN_COLUMN_TARGET, PEN_RUN_END_CELL, PEN_ROW_TARGET } from "./names.js";

/** (target - current) times sixteen, keeping only the signed high byte: the per-step increment. */
function stepToward(target, current) {
  const delta = u16(target - current);
  const highByte = (delta >> 12) & 1 ? (0xff << 8) : 0;
  return u16(highByte | ((delta >> 4) & 0xff));
}

const parity8 = (v) => {
  let bits = 0;
  for (let x = v; x; x >>= 1) bits += x & 1;
  return bits & 1 ? 0 : F_PV;
};
const sz8 = (v) => (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5));
// Flags an AND of a byte with itself leaves: sign/zero/undocumented from the byte, half-carry always,
// parity, no subtract, no carry. The Z bit (byte == 0) is the live-out callers read via regs.fNZ.
const andFlags = (v) => sz8(v) | F_H | parity8(v);

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
  const word = fetchTableWord(m, mem8[PEN_ROUTE_LEG], PEN_ROUTE_TABLE);

  const rowInt = word & 0xff;
  mem8[PEN_ROW_POS] = 0;
  mem8[PEN_ROW_POS + 1] = rowInt;
  mem8[PEN_COLUMN_POS] = 0;
  mem8[PEN_COLUMN_POS + 1] = word >> 8;

  // A carries the new row integer; the AND-with-itself seats the flags -- Z when the row integer is
  // zero -- that callers branch on via regs.fNZ. The original's return is this function's own return.
  return (regs.a = rowInt, regs.f = andFlags(rowInt));
}
