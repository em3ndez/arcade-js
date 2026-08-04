// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBonusExpiredStep — run whichever step of the bonus-expired sequence is current, and
 * report whether the rest of the frame's gameplay work should still run.
 *
 * When the on-screen BONUS counter runs down to zero the player is killed for it, and that does
 * not happen in one frame. BONUS_EXPIRED_STEP is the small four-state machine that carries it
 * out; this router reads the step byte once a frame and runs the handler for it:
 *
 *   step 0  idle       — the bonus has not expired, so nothing happens.
 *   step 1  start      — clear the delay counter and move on to step 2.
 *   step 2  delay      — count that delay down; when it reaches zero, move on to step 3.
 *   step 3  wait, exit — hold until Mario is back on the ground, then take the death exit.
 *
 * The return value is a carry-on-or-abandon answer about the REST of the frame: true means the
 * per-frame gameplay work continues, false means it is abandoned for this frame. Only step 3 can
 * ever answer false, and only on the arm that takes the death exit — steps 0, 1 and 2 always
 * continue, so this router answers a constant true for them and passes step 3's own answer
 * straight through.
 *
 * The step byte never leaves the range 0 to 3 in play, and there is no handler behind a value
 * that does: it is a frontier with nothing on the other side, so it raises rather than falling
 * quietly through to a wrong step.
 *
 * LIVE-OUT: whatever the chosen handler writes, plus the carry-on-or-abandon answer.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BONUS_EXPIRED_STEP } from "./names.js";
import { bonusExpiredIdle } from "./bonusExpiredIdle.js";
import { startBonusExpiredDelay } from "./startBonusExpiredDelay.js";
import { advanceBonusExpiredStepWhenDelayExpires } from "./advanceBonusExpiredStepWhenDelayExpires.js";
import { advanceSubstateWhenGrounded } from "./advanceSubstateWhenGrounded.js";

export function dispatchBonusExpiredStep(m) {
  const step = m.mem.read8(BONUS_EXPIRED_STEP);

  switch (step) {
    case 0: // idle: the bonus has not expired, so nothing happens; the frame continues.
      bonusExpiredIdle(m);
      return true;
    case 1: // start: clear the delay counter and move to step 2; the frame continues.
      startBonusExpiredDelay(m);
      return true;
    case 2: // delay: tick the counter down and move to step 3 at zero; the frame continues.
      advanceBonusExpiredStepWhenDelayExpires(m);
      return true;
    case 3: // wait and exit: hold until grounded, then take the death exit. The only step
      // that can abandon the frame, so its answer is passed straight through.
      return advanceSubstateWhenGrounded(m);
    default:
      // Past step 3 there is no handler at all — a frontier the step byte never reaches
      // in play, so it raises rather than running the wrong step.
      throw new NotImplemented(
        `dispatchBonusExpiredStep: BONUS_EXPIRED_STEP=0x${(step & 0xff).toString(16)} ` +
          "out of the 0..3 range (rst-0x28 table past idx3 is dw 0x0000 -> wild jp 0x0000); " +
          "non-executing frontier.",
      );
  }
}
