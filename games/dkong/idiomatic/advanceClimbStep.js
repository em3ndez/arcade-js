// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceClimbStep — advance one climb-animation step for Mario.  ROM 0x1D11.
 *
 * The shared body both climb steppers fall into: entry_1d03 (ROM 0x1D03) enters it
 * with a −2 step, its twin climbMarioDown (ROM 0x1CF2) with a +2 step, so the per-frame
 * vertical step is the caller's input.
 *
 * Each step it:
 *   1. Nudges Mario's height (MARIO_Y) by the caller's step and keeps the new height.
 *   2. Flips a two-phase ladder-centering counter. On the phase that flips it non-zero
 *      it finalizes the step through the centering path — snap Mario onto the ladder
 *      column, tick the footstep, commit his sprite (centerMarioAndCommitClimbStep).
 *   3. On the other phase it decides the step's outcome from where the new height sits
 *      relative to the ladder's two extent limits (MARIO_CLIMB_LIMIT_A/B), measured in
 *      (Y + 8) units:
 *        - at either limit → the climb has reached a ladder end, so dismount
 *          (endClimbAtLadderLimit);
 *        - otherwise pick this step's climb sprite frame by how far above the near
 *          limit Mario sits — 8 units up is frame 5, 12 up is frame 4, anything else
 *          is frame 3 (setClimbSpriteFrame).
 *
 * NAME (promoted, DK understanding pass 7 — independent proposer≠confirmer): the shared
 * climb stepper. Grounded by the [seen] MARIO_CLIMB_LIMIT_A/B (0x621B/0x621C) cells, whose
 * registry comment names this routine (ROM 0x1D28/0x1D2E) the climb stepper that stops and
 * clears MARIO_ON_LADDER when (newY+8) equals either limit. (Its two idiomatic callers
 * climbMarioUp (ROM 0x1D03, −2) and climbMarioDown (ROM 0x1CF2, +2) are climb-up / climb-down.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d11.test.js.
 * GATE:     crafted-entry + real dispatches — attract's 25m demo climbs a ladder, so
 *           0x1D11 is dispatched for real; crafted entries additionally force the
 *           center phase, both ladder-end exits, and each of the three climb-frame
 *           selections, plus a non-zero step to pin the height update. The chain ends
 *           in the callees' single net return, so the gate compares pc + SP with one
 *           modeled return. Teeth: dropped-step, dropped-toggle, wrong-frame twins.
 * LIVE-OUT: memory-only — MARIO_Y and the centering-phase byte here, plus whatever the
 *           chosen callee writes. Both callers tail into this body and consume no
 *           register it leaves, so no live registers/flags.
 * NAMES:    MARIO_Y, MARIO_CLIMB_LIMIT_A/B (ram.js). The centering-phase byte 0x6222
 *           stays hex — shared climb-centering scratch, unnamed in ram.js (also written
 *           by slide50mObjectDown). Dispatches to the already-idiomatic centerMarioAndCommitClimbStep
 *           (0x1D51), endClimbAtLadderLimit (0x1D67), setClimbSpriteFrame (0x1D3F).
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./ram.js";
import { centerMarioAndCommitClimbStep } from "./centerMarioAndCommitClimbStep.js"; // ROM 0x1D51
import { endClimbAtLadderLimit } from "./endClimbAtLadderLimit.js";                 // ROM 0x1D67
import { setClimbSpriteFrame } from "./setClimbSpriteFrame.js";                     // ROM 0x1D3F

// Two-phase ladder-centering toggle: flips 0<->1 each step and gates which arm runs.
// Unnamed in ram.js (shared scratch, also written by slide50mObjectDown at 0x2295), so kept hex.
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
    centerMarioAndCommitClimbStep(m); // ROM 0x1D51
    return;
  }

  // 3. Off-beat: locate the new height between the ladder's two extent limits, in
  //    (Y + 8) units. At either limit, the climb has reached a ladder end.
  const probe = u8(newY + 8);
  if (probe === mem.read8(MARIO_CLIMB_LIMIT_B)) {
    endClimbAtLadderLimit(m); // ROM 0x1D67 — reached the far ladder end
    return;
  }
  const nearLimit = mem.read8(MARIO_CLIMB_LIMIT_A);
  if (probe === nearLimit) {
    endClimbAtLadderLimit(m); // ROM 0x1D67 — reached the near ladder end
    return;
  }

  // Not at a limit: pick the climb frame by distance above the near limit.
  const dist = u8(probe - nearLimit);
  const frame = dist === 8 ? 5 : dist === 12 ? 4 : 3;
  setClimbSpriteFrame(m, frame); // ROM 0x1D3F
}
