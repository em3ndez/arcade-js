// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateWhenGrounded — the wait+exit step of the bonus-expired sub-state sequence:
 * while Mario is airborne, return true (cascade runs on); once grounded, run the shared advance
 * tail (step the sub-state, re-arm its timer) and return false (caller-skip aborts the frame).
 *
 * LIVE-OUT: memory-only on the grounded branch — the sub-state index and timer written by the
 * shared tail — plus the boolean caller-skip return.
 */

import { MARIO_AIRBORNE } from "./names.js";
import { advanceSubstateAndArmTimer } from "./advanceSubstateAndArmTimer.js";

export function advanceSubstateWhenGrounded(m) {
  const { mem8 } = m;

  if (mem8[MARIO_AIRBORNE] !== 0) return true;

  advanceSubstateAndArmTimer(m);
  return false;
}
