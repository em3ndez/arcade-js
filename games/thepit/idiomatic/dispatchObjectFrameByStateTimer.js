// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchObjectFrameByStateTimer — per-frame head of the object/state dispatcher, gated by the
 * state-lockout timer.  A countdown (TRANSITION_TIMER) can hold the tracked object frozen in a
 * timed state. Idle (zero): the object is free, so advance it through the object/state dispatcher.
 * Running: tick it down and, while still running, do nothing else. Reaching zero this frame: the
 * timed state is over, so hand to a round-boundary routine chosen by POST_TRANSITION_MODE (mode
 * zero to the round/state-boundary dispatcher, else the next-level advance). Writes no memory of
 * its own beyond the countdown decrement.
 */

import { TRANSITION_TIMER, POST_TRANSITION_MODE } from "./names.js";
import { advanceTrackedObject } from "./advanceTrackedObject.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";
import { advanceToNextLevel } from "./advanceToNextLevel.js";

export function dispatchObjectFrameByStateTimer(m) {
  const { mem8 } = m;

  // Countdown idle: the object is free this frame — run the object/state dispatcher.
  if (mem8[TRANSITION_TIMER] === 0) return advanceTrackedObject(m);

  // Countdown running: tick it down and hold the object locked while it is still running.
  const remaining = mem8[TRANSITION_TIMER] - 1;
  mem8[TRANSITION_TIMER] = remaining;
  if (remaining !== 0) return; // still locked -> nothing else this frame

  // Countdown reached zero: the timed state is over, a mid-frame warm restart. Abandon this frame
  // and swap the whole main generator; POST_TRANSITION_MODE picks which boundary loop runs.
  if (mem8[POST_TRANSITION_MODE] === 0) return m.restartMain(() => dockManAndDispatchRoundBoundary(m));
  return m.restartMain(() => advanceToNextLevel(m));
}
