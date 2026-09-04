// SPDX-License-Identifier: GPL-3.0-only
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { FRAME_DELAY_TIMER } from "./names.js";

// Player-switch handoff wait: while the arm-trigger reads its armed value, hold for up to 0x30 displayed
// frames, re-polling the trigger each frame; the moment the trigger leaves that value, fall through and
// wait until it returns to the armed value before proceeding. Each pass yields one frame; the interrupt
// drains the counter. Generator; memory-only.
export function* waitNextRoundArm(m) {
  if (isArmTriggerSet(m)) {
    m.mem8[FRAME_DELAY_TIMER] = 0x30;
    for (;;) {
      if (m.mem8[FRAME_DELAY_TIMER] === 0) return;
      if (!isArmTriggerSet(m)) break;
      yield;
    }
  }
  while (!isArmTriggerSet(m)) yield;
}
