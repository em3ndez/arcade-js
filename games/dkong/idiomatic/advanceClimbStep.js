// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceClimbStep — the shared climb-step body both steppers fall into (up enters with -2, down
 * with +2): nudge Mario's height by the caller's step, flip the two-phase ladder-centering counter,
 * and either finalize through the centering path or, on the off-beat, decide the outcome from where
 * the new height sits between the ladder's two extent limits (measured in Y+8 units) — dismount at
 * a limit, else pick the climb frame by distance above the near limit (8 -> 5, 12 -> 4, else 3).
 *
 * LIVE-OUT: memory-only — Mario's height and the centering-phase byte, plus whatever the chosen
 * continuation writes.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { centerMarioAndCommitClimbStep } from "./centerMarioAndCommitClimbStep.js";
import { endClimbAtLadderLimit } from "./endClimbAtLadderLimit.js";
import { setClimbSpriteFrame } from "./setClimbSpriteFrame.js";

// Two-phase ladder-centering toggle: flips 0<->1 each step and gates which arm runs. File-local:
// another routine writes the same byte for an unrelated purpose.
const CENTERING_PHASE = 0x6222;

export function advanceClimbStep(m, climbStep) {
  const { mem8 } = m;

  const newY = u8(mem8[MARIO_Y] + climbStep);
  mem8[MARIO_Y] = newY;

  const phase = mem8[CENTERING_PHASE] ^ 1;
  mem8[CENTERING_PHASE] = phase;
  if (phase !== 0) {
    centerMarioAndCommitClimbStep(m);
    return;
  }

  const probe = u8(newY + 8);
  if (probe === mem8[MARIO_CLIMB_LIMIT_B]) {
    endClimbAtLadderLimit(m);
    return;
  }
  const nearLimit = mem8[MARIO_CLIMB_LIMIT_A];
  if (probe === nearLimit) {
    endClimbAtLadderLimit(m);
    return;
  }

  const dist = u8(probe - nearLimit);
  const frame = dist === 8 ? 5 : dist === 12 ? 4 : 3;
  setClimbSpriteFrame(m, frame);
}
