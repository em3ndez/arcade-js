// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2602 — per-frame driver for one of the 50m board's timed, back-and-forth sprite objects.
 * On even frames it ticks a turnaround countdown and, on underflow, reloads it to 0x80 and
 * reverses the step direction; every frame it republishes the direction through an odd-frame sign
 * helper (so the object moves at half speed); and on every 32nd frame it advances the mirrored
 * sprite-animation counter pair.
 *
 * LIVE-OUT: memory-only — the countdown, the step direction, the published step, and the
 * sprite-animation counter pair.
 */

import { FRAME, M50_OBJ1_REVERSE_TIMER, M50_OBJ1_STEP_DIR, M50_OBJ1_STEP, M50_OBJ1_SPRITE_PAIR_BASE } from "./names.js";
import { reverseStepDirection } from "./reverseStepDirection.js";
import { loc_26a6 } from "./loc_26a6.js";
import { signStepHalfRate } from "./signStepHalfRate.js";

export function loc_2602(m) {
  const { regs, mem8 } = m;

  // Even frames only: tick the turnaround countdown.
  if ((mem8[FRAME] & 0x01) === 0) {
    const next = (mem8[M50_OBJ1_REVERSE_TIMER] - 1) & 0xff;
    mem8[M50_OBJ1_REVERSE_TIMER] = next;
    if (next === 0) {
      mem8[M50_OBJ1_REVERSE_TIMER] = 0x80;
      reverseStepDirection(m, M50_OBJ1_STEP_DIR);
    }
  }

  // Every frame: republish the direction through the odd-frame sign helper as this object's step.
  regs.hl = M50_OBJ1_STEP_DIR;
  signStepHalfRate(m);
  mem8[M50_OBJ1_STEP] = regs.a;

  // Every 32nd frame: advance the mirrored sprite-animation counter pair.
  if ((mem8[FRAME] & 0x1f) !== 0x01) return;
  loc_26a6(m, M50_OBJ1_SPRITE_PAIR_BASE, 0xe4, M50_OBJ1_STEP_DIR);
}
