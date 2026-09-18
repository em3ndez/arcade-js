// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_262f — per-frame driver for the second of three timed board objects: pick an arm by how
 * high Mario is on the screen, then run the shared publish/animate tail. Mario high forces the
 * step-direction latch negative; otherwise, on even frames, an object reverse timer ticks and,
 * on expiry, reloads and flips the step-direction sign.
 *
 * LIVE-OUT: memory-only. Every exit hands off to the shared tail.
 */

import { MARIO_Y, FRAME, M50_OBJ2_REVERSE_TIMER, M50_OBJ2_STEP_DIR } from "./names.js";
import { loc_266f } from "./loc_266f.js";
import { reverseStepDirection } from "./reverseStepDirection.js";
import { loc_264c } from "./loc_264c.js";

export function loc_262f(m) {
  const { regs, mem8 } = m;

  // Mario high on the screen (smaller Y is higher): force step-direction negative.
  if (mem8[MARIO_Y] < 0xc0) {
    return loc_266f(m);
  }

  // Only run the reverse timer on even frames.
  if ((mem8[FRAME] & 0x01) !== 0) {
    return loc_264c(m);
  }

  const next = (mem8[M50_OBJ2_REVERSE_TIMER] - 1) & 0xff;
  mem8[M50_OBJ2_REVERSE_TIMER] = next;
  if (next !== 0) {
    return loc_264c(m);
  }

  // Expired: reload the timer and reverse the step-direction sign.
  mem8[M50_OBJ2_REVERSE_TIMER] = 0xc0;
  reverseStepDirection(m, M50_OBJ2_STEP_DIR);
  return loc_264c(m);
}
