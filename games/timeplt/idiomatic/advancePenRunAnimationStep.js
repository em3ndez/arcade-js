// SPDX-License-Identifier: GPL-3.0-only
/** advancePenRunAnimationStep — advance one interpolated pen-run and bail unless it reseated to a zero row integer,
 * then two's-complement checksum the guarded code block into the guard cell (0 on a clean image)
 * and step the sequence sub-index. LIVE-OUT: memory only. */

import { drawInterpolatedPenRun } from "./drawInterpolatedPenRun.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { BANK_LAUNCH_COOLDOWN } from "./names.js";

const GUARDED_BLOCK = 0x1748;
const GUARDED_LEN = 0x22;

export function advancePenRunAnimationStep(m) {
  const { regs, mem8 } = m;
  drawInterpolatedPenRun(m);
  if (regs.fNZ) return;

  let sum = 0;
  for (let i = 0; i < GUARDED_LEN; i++) sum = (sum - mem8[GUARDED_BLOCK + i]) & 0xff;
  mem8[BANK_LAUNCH_COOLDOWN] = sum;
  return advanceSequenceSubStep(m);
}
