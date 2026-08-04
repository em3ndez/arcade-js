// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2602 — per-frame driver for one of the 50m board's timed, back-and-forth sprite objects.
 *
 * The object's state is two bytes: a countdown that decides when it turns around, and a signed
 * step direction. Each frame this routine does three things:
 *
 *   1. On EVEN frames only, tick the countdown down. On the single frame it underflows past 0,
 *      reload it to 0x80 and REVERSE the step direction (+2 if it was negative, else -2). Because
 *      it only counts on even frames, that is a turnaround roughly every 256 frames.
 *
 *   2. EVERY frame, republish the step: an odd-frame sign helper is applied to the direction byte
 *      and whatever it returns is stored as the object's current signed X-step. On an even frame
 *      the helper writes nothing and yields 0, so the object holds still; on an odd frame it
 *      normalises the direction byte to -1 or +1 and yields that, so the object shifts one pixel.
 *      The result is that the object moves at half speed, in the direction step 1 last chose.
 *
 *   3. On every 32nd frame, advance the object's mirrored sprite-animation counter pair one step,
 *      in the direction the step-direction byte's sign selects. On the other 31 frames the
 *      routine returns before this.
 *
 * NOT CLAIMED: which on-screen object this drives. The animation counters live in an unnamed
 * sprite-buffer slot, and nothing here identifies what is drawn from it — hence the neutral name.
 *
 * LIVE-OUT: memory-only — the countdown, the step direction, the published step, and the
 * sprite-animation counter pair.
 */

import { FRAME, M50_OBJ1_REVERSE_TIMER, M50_OBJ1_STEP_DIR, M50_OBJ1_STEP } from "./names.js";
import { reverseStepDirection } from "./reverseStepDirection.js";
import { loc_26a6 } from "./loc_26a6.js";
import { loc_26e9 } from "../translated/loc_26e9.js";

export function loc_2602(m) {
  const { regs, mem } = m;

  // Even frames only: tick the turnaround countdown.
  if ((mem.read8(FRAME) & 0x01) === 0) {
    const next = (mem.read8(M50_OBJ1_REVERSE_TIMER) - 1) & 0xff;
    mem.write8(M50_OBJ1_REVERSE_TIMER, next);
    if (next === 0) {
      // Underflowed: reload the period and reverse the object's step-direction sign.
      mem.write8(M50_OBJ1_REVERSE_TIMER, 0x80);
      regs.hl = M50_OBJ1_STEP_DIR; // the sign byte the reversal reads and rewrites
      reverseStepDirection(m);
    }
  }

  // Every frame: run the direction byte through the odd-frame sign helper and publish what it
  // yields as this object's step. Even frame -> 0 and no rewrite; odd frame -> the direction byte
  // is normalised to a unit step and that is what gets published.
  regs.hl = M50_OBJ1_STEP_DIR;
  loc_26e9(m);
  mem.write8(M50_OBJ1_STEP, regs.a);

  // Every 32nd frame: advance the mirrored sprite-animation counter pair.
  if ((mem.read8(FRAME) & 0x1f) !== 0x01) return;
  regs.de = M50_OBJ1_STEP_DIR; // the direction byte the advance picks its arm from
  regs.hl = 0x69e4; // the counter-pair base
  loc_26a6(m);
}
