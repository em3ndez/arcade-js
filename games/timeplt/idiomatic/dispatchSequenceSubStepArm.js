// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequenceSubStepArm — dispatch the arm the sub-step's low nibble selects off an inline word table, parking
 * its return slot first, then run the fixed continuation. LIVE-OUT: memory. */

import { SEQUENCE_SUBSTEP, advanceAttractTowardGameStart_ADDR, loc_0f29 } from "./names.js";
import { advanceAttractTowardGameStart } from "./advanceAttractTowardGameStart.js";

const ARM_MASK = 0x0f;

export function dispatchSequenceSubStepArm(m) {
  const arm = m.mem16[loc_0f29 + 2 * (m.mem8[SEQUENCE_SUBSTEP] & ARM_MASK)];
  m.push16(advanceAttractTowardGameStart_ADDR);
  m.call(arm);
  advanceAttractTowardGameStart(m);
}
