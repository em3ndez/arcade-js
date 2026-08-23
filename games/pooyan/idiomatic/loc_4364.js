// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceFallStep } from "./advanceFallStep.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * loc_4364 — object state handler: while the record's phase timer is non-zero, count it down and
 * return; at zero, step the animation, advance one fall step, and tail-blank the sprite band on land.
 * LIVE-OUT: none consumed — a table-dispatched handler; the tail-blank propagates its callee's exit.
 */

const PHASE_TIMER = 0x11;

export function loc_4364(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + PHASE_TIMER] !== 0) {
    mem8[rec + PHASE_TIMER] = mem8[rec + PHASE_TIMER] - 1;
    return;
  }

  advanceObjectAnimationFrame(m, rec);
  if (advanceFallStep(m, rec)) return;
  return blankActorSpriteBand(m, rec);
}
