// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2679 — on odd frames, drop straight to the shared tail. On even frames, tick the third
 * object's reversal countdown; when it expires reload it to its full period and reverse the
 * object's step-direction latch. Every path ends in the shared publish/animate tail.
 *
 * LIVE-OUT: memory-only. Every path ends in the shared tail.
 */

import { u8 } from "../../../core/int.js";
import { FRAME, M50_OBJ3_REVERSE_TIMER, M50_OBJ3_STEP_DIR } from "./names.js";
import { loc_268d } from "./loc_268d.js";
import { reverseStepDirection } from "./reverseStepDirection.js";

export function loc_2679(m) {
  const { regs, mem8 } = m;

  if ((mem8[FRAME] & 0x01) !== 0) return loc_268d(m);

  const remaining = u8(mem8[M50_OBJ3_REVERSE_TIMER] - 1);
  mem8[M50_OBJ3_REVERSE_TIMER] = remaining;
  if (remaining !== 0) return loc_268d(m);

  mem8[M50_OBJ3_REVERSE_TIMER] = 0xff;
  regs.hl = M50_OBJ3_STEP_DIR; // the reversal helper flips the byte at this pointer
  reverseStepDirection(m);
  return loc_268d(m);
}
