// SPDX-License-Identifier: GPL-3.0-only
/** loc_5bd7 — inner sequence arm: blank a fixed character run, advance the interpolated pen run,
 * and bail unless it reseated to a zero row integer. On the full path fold two guarded code blocks —
 * one raises the sequence phase unless it folds to a fixed value, the other rolls a work cell and
 * leaves it unchanged on a clean image — then step the sequence sub-index. LIVE-OUT: memory. */

import { blankFourteenCharCells } from "./blankFourteenCharCells.js";
import { drawInterpolatedPenRun } from "./drawInterpolatedPenRun.js";
import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8 } from "../../../core/int.js";

const XOR_BLOCK = 0x0bdd;
const XOR_LEN = 256;
const XOR_TARGET = 0x1c;
const SUM_BLOCK = 0x1734;
const SUM_LEN = 20;
const SUM_BIAS = 0x77;
const GUARD_CELL = 0xa9ab;

export function loc_5bd7(m) {
  const { regs, mem8 } = m;
  blankFourteenCharCells(m);
  drawInterpolatedPenRun(m);
  if (regs.fNZ) return;

  let fold = 0;
  for (let i = 0; i < XOR_LEN; i++) fold ^= mem8[XOR_BLOCK + i];
  if (fold !== XOR_TARGET) advanceSequencePhase(m);

  let acc = mem8[GUARD_CELL];
  for (let i = 0; i < SUM_LEN; i++) acc = u8(acc + mem8[SUM_BLOCK + i]);
  mem8[GUARD_CELL] = u8(acc + SUM_BIAS);

  return advanceSequenceSubStep(m);
}
