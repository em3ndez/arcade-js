// SPDX-License-Identifier: GPL-3.0-only
import { keepClimberFlipBitByDepth } from "./keepClimberFlipBitByDepth.js";
import { stepClimberSegmentAndHeading } from "./stepClimberSegmentAndHeading.js";

// Full entry for the per-slot segment step: run the gated bit6-keeper guard first, then
// delegate to the shared mid-entry body (the guard-less entry runs the same body). Slot
// chosen by x; the live-out is whatever the shared body leaves.
export function stepClimberSegmentGuarded(m, x = m.regs.x) {
  keepClimberFlipBitByDepth(m, x);        // gated per-slot bit6-keeper guard (head work)
  return stepClimberSegmentAndHeading(m, x); // shared tail
}
