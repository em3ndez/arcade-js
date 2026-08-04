// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceClimbStep — advance one climb-animation step for Mario.
 *
 * The shared body both climb steppers fall into: the up stepper enters with a −2 step, the
 * down stepper with a +2 step, so the per-frame vertical step is the caller's input.
 *
 * Each step it:
 *   1. Nudges Mario's height by the caller's step and keeps the new height.
 *   2. Flips a two-phase ladder-centering counter. On the phase that flips it non-zero it
 *      finalizes the step through the centering path — snap Mario onto the ladder column,
 *      tick the footstep, commit his sprite.
 *   3. On the other phase it decides the step's outcome from where the new height sits
 *      relative to the ladder's two extent limits, measured in (Y + 8) units:
 *        - at either limit, the climb has reached a ladder end, so dismount;
 *        - otherwise pick this step's climb sprite frame by how far above the near limit
 *          Mario sits — 8 units up is frame 5, 12 up is frame 4, anything else is frame 3.
 *
 * LIVE-OUT: memory-only — Mario's height and the centering-phase byte written here, plus
 * whatever the chosen continuation writes.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { centerMarioAndCommitClimbStep } from "./centerMarioAndCommitClimbStep.js";
import { endClimbAtLadderLimit } from "./endClimbAtLadderLimit.js";
import { setClimbSpriteFrame } from "./setClimbSpriteFrame.js";

// Two-phase ladder-centering toggle: flips 0<->1 each step and gates which arm runs. It
// carries no shared name — another routine writes the same byte for an unrelated purpose, so
// no single name would be true of both — and is file-local here.
const CENTERING_PHASE = 0x6222;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @param {number} climbStep  the caller's per-frame vertical step, as a byte (0xFE = up 2,
 *   0x02 = down 2); added to MARIO_Y with byte-wrap.
 * @returns {void}
 */
export function advanceClimbStep(m, climbStep) {
  const { mem } = m;

  // 1. Advance Mario's height by this frame's step; remember the new height.
  const newY = u8(mem.read8(MARIO_Y) + climbStep);
  mem.write8(MARIO_Y, newY);

  // 2. Flip the centering phase. On the phase that lands non-zero, finalize the step
  //    through the centering path (snap to column, footstep, commit sprite).
  const phase = mem.read8(CENTERING_PHASE) ^ 1;
  mem.write8(CENTERING_PHASE, phase);
  if (phase !== 0) {
    centerMarioAndCommitClimbStep(m);
    return;
  }

  // 3. Off-beat: locate the new height between the ladder's two extent limits, in
  //    (Y + 8) units. At either limit, the climb has reached a ladder end.
  const probe = u8(newY + 8);
  if (probe === mem.read8(MARIO_CLIMB_LIMIT_B)) {
    endClimbAtLadderLimit(m); // reached the far ladder end
    return;
  }
  const nearLimit = mem.read8(MARIO_CLIMB_LIMIT_A);
  if (probe === nearLimit) {
    endClimbAtLadderLimit(m); // reached the near ladder end
    return;
  }

  // Not at a limit: pick the climb frame by distance above the near limit.
  const dist = u8(probe - nearLimit);
  const frame = dist === 8 ? 5 : dist === 12 ? 4 : 3;
  setClimbSpriteFrame(m, frame);
}
