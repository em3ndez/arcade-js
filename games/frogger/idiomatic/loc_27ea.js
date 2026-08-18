// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27ea — dive/turtle animation driver: dispatch on the dive phase.
 * The below-2 phase is a no-op; the at-or-above-5 phase hands off to a dedicated arm; the middle band
 * runs an extra step when a secondary counter is zero, then continues into the shared surface-timer step.
 * LIVE-OUT: memory-only.
 */
import { LIVES_COUNT, FIGURE_ANIM_PHASE } from "./names.js";
import { armDiveHighPhase } from "./armDiveHighPhase.js";
import { resetDiveSurfaceCounter } from "./resetDiveSurfaceCounter.js";
import { stepDiveSurfaceTimer } from "./stepDiveSurfaceTimer.js";

export function loc_27ea(m) {
  const { mem8 } = m;

  const phase = mem8[LIVES_COUNT];
  if (phase < 2) return;
  if (phase >= 5) return armDiveHighPhase(m);

  if (mem8[FIGURE_ANIM_PHASE] === 0) {
    resetDiveSurfaceCounter(m);
    return stepDiveSurfaceTimer(m);
  }
  return stepDiveSurfaceTimer(m);
}
