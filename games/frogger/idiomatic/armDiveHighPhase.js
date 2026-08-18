// SPDX-License-Identifier: GPL-3.0-only
/**
 * armDiveHighPhase — high-phase (level >= 5) dive arm. While the figure-animation phase is idle,
 * run the one-shot frame arm; either way, continue into the shared surface-timer step.
 */
import { armTwoPairFigureFrame } from "./armTwoPairFigureFrame.js";
import { stepDiveSurfaceTimer } from "./stepDiveSurfaceTimer.js";
import { FIGURE_ANIM_PHASE } from "./names.js";

export function armDiveHighPhase(m) {
  if (m.mem8[FIGURE_ANIM_PHASE] === 0) {
    armTwoPairFigureFrame(m); // one-shot seed while the figure phase is idle
  }
  return stepDiveSurfaceTimer(m);
}
