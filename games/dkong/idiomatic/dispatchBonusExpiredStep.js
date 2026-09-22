// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBonusExpiredStep — run the current step of the bonus-expired sequence (BONUS_EXPIRED_STEP)
 * and report whether the rest of the frame's gameplay should still run.
 *
 *   step 0 idle · step 1 start (clear delay, →2) · step 2 delay (count down, →3) ·
 *   step 3 wait then take the death exit.
 *
 * Steps 0-2 always continue (true); only step 3 can abandon the frame, so its answer passes
 * straight through. Any step outside 0-3 raises.
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
  const { mem8 } = m;
  const step = mem8[BONUS_EXPIRED_STEP];

  switch (step) {
    case 0:
      bonusExpiredIdle(m);
      return true;
    case 1:
      startBonusExpiredDelay(m);
      return true;
    case 2:
      advanceBonusExpiredStepWhenDelayExpires(m);
      return true;
    case 3:
      return advanceSubstateWhenGrounded(m);
    default:
      throw new NotImplemented(
        `dispatchBonusExpiredStep: BONUS_EXPIRED_STEP=0x${(step & 0xff).toString(16)} ` +
          "out of the 0..3 range (rst-0x28 table past idx3 is a null dw -> wild jp to address 0); " +
          "non-executing frontier.",
      );
  }
}
