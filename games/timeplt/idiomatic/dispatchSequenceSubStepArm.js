// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequenceSubStepArm — dispatch the arm the sub-step's low nibble selects off an inline word table, parking
 * its return slot first, then run the fixed continuation. LIVE-OUT: memory. */

import { SEQUENCE_SUBSTEP } from "./names.js";
import { advanceAttractTowardGameStart } from "./advanceAttractTowardGameStart.js";

const ARM_TABLE = 0x0f29;
const ARM_MASK = 0x0f;
const AFTER_ARM = 0x0f54;

export function dispatchSequenceSubStepArm(m) {
  const arm = m.mem16[ARM_TABLE + 2 * (m.mem8[SEQUENCE_SUBSTEP] & ARM_MASK)];
  m.push16(AFTER_ARM);
  m.call(arm);
  advanceAttractTowardGameStart(m);
}
