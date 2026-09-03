// SPDX-License-Identifier: GPL-3.0-only
import { loc_0a59 } from "./loc_0a59.js";
import { FRAME_DELAY_TIMER } from "./names.js";

// Player-switch handoff wait: while the arm-trigger reads its armed value, hold for up to 0x30 displayed
// frames, re-polling the trigger each frame; the moment the trigger leaves that value, fall through and
// wait until it returns to the armed value before proceeding. Each pass yields one frame; the interrupt
// drains the counter. Generator; memory-only.
export function* loc_0a3c(m) {
  if (loc_0a59(m)) {
    m.mem8[FRAME_DELAY_TIMER] = 0x30;
    for (;;) {
      if (m.mem8[FRAME_DELAY_TIMER] === 0) return;
      if (!loc_0a59(m)) break;
      yield;
    }
  }
  while (!loc_0a59(m)) yield;
}
