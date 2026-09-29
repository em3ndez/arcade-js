// SPDX-License-Identifier: GPL-3.0-only
/** blankCaptionThenAdvancePenRunStep — inner sequence arm: blank a fixed character run, advance the interpolated pen run,
 * and bail unless it reseated to a zero row integer. On the full path fold two guarded code blocks —
 * one raises the sequence phase unless it folds to a fixed value, the other rolls a work cell and
 * leaves it unchanged on a clean image — then step the sequence sub-index. LIVE-OUT: memory. */

import { blankFourteenCharCells } from "./blankFourteenCharCells.js";
import { drawInterpolatedPenRun } from "./drawInterpolatedPenRun.js";
import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8 } from "../../../core/int.js";
import { F_Z } from "../../../core/cpu/z80.js";
import { advancePenRunAnimationStep_ADDR, IMAGE_GUARD_BLOCK_0BDD_BASE, SEQUENCE_PHASE } from "./names.js";

const XOR_LEN = 256;
const XOR_TARGET = 0x1c;
const SUM_LEN = 20;
const SUM_BIAS = 0x77;

export function blankCaptionThenAdvancePenRunStep(m) {
  const { mem8 } = m;
  blankFourteenCharCells(m);
  // The run hands back the flags it settles on; Z set means it reseated to a zero row integer.
  const reseatedAtRowZero = (drawInterpolatedPenRun(m) & F_Z) !== 0;
  if (!reseatedAtRowZero) return;

  let fold = 0;
  for (let i = 0; i < XOR_LEN; i++) fold ^= mem8[IMAGE_GUARD_BLOCK_0BDD_BASE + i];
  if (fold !== XOR_TARGET) advanceSequencePhase(m);

  let acc = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < SUM_LEN; i++) acc = u8(acc + mem8[advancePenRunAnimationStep_ADDR + i]);
  mem8[SEQUENCE_PHASE] = u8(acc + SUM_BIAS);

  return advanceSequenceSubStep(m);
}
