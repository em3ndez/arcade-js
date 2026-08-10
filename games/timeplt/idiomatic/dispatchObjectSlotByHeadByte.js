// SPDX-License-Identifier: GPL-3.0-only
/** dispatchObjectSlotByHeadByte — split three ways on the head byte of the record the index register points at. Zero
 * is an exit with nothing done; all-ones and every other non-zero value each hand over to their
 * own continuation. That split is the whole of the routine: one byte read, nothing written, and
 * neither continuation is given anything this entry computed. LIVE-OUT: whatever it hands over to. */

import { flyAndRetireSlotCyclingShapeInEra4 } from "./flyAndRetireSlotCyclingShapeInEra4.js";
import { runSlotCountdownDriftAndAnimateElseRetire } from "./runSlotCountdownDriftAndAnimateElseRetire.js";

const ALL_ONES = 255;

export function dispatchObjectSlotByHeadByte(m) {
  const head = m.mem8[m.regs.ix];
  if (head === 0) return;
  return head === ALL_ONES
    ? flyAndRetireSlotCyclingShapeInEra4(m)
    : runSlotCountdownDriftAndAnimateElseRetire(m);
}
