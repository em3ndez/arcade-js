// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_EXTEND_STATE } from "./names.js";
import { addRopeSegmentAndAdvanceExtendState } from "./addRopeSegmentAndAdvanceExtendState.js";
import { advanceRopeExtendAnimation } from "./advanceRopeExtendAnimation.js";

/**
 * dispatchRopeExtendState — per-frame driver for the rope-extend state machine. Runs the handler for
 * the current rope-extend state; the handler returns to our caller (a tail dispatch). Two states.
 *
 * LIVE-OUT: none — a void per-frame dispatch; the caller reads nothing back.
 */
export function dispatchRopeExtendState(m) {
  switch (m.mem8[ROPE_EXTEND_STATE]) {
    case 0: return addRopeSegmentAndAdvanceExtendState(m);
    case 1: return advanceRopeExtendAnimation(m);
  }
}
