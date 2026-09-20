// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBarrelSlotIfLive — the barrel walk's per-slot gate: hand a live record to the motion
 * dispatch, or step the staging cursor's low byte past three of the four bytes this slot leaves
 * alone (the fourth is the shared between-slots step, so the cursor lands on a record boundary).
 * ⚠ The test is equality with 1, NOT a bit test: a record holding 2 is skipped like one holding 0.
 * LIVE-OUT: the staging cursor's low byte plus the propagated return; carry passes through.
 */

import { advanceBarrelMotion } from "./advanceBarrelMotion.js";
import { OBJ_ACTIVE } from "./names.js";

export function serviceBarrelSlotIfLive(m, record = m.regs.ix, cursorLow = m.regs.l) {
  const { regs, mem8 } = m;

  if (mem8[record + OBJ_ACTIVE] === 1) return advanceBarrelMotion(m);

  regs.l = cursorLow + 3; // low byte only, so the cursor never leaves its page
  return m.call(0x1f8d);
}
