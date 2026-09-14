// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { prepCountThenComposeFrame } from "./prepCountThenComposeFrame.js";

// Draw one object slot, then run the shared post-draw step.
export function drawFrameWithSlot08(m) {
  drawSlotShapeRecord(m, 0x08);
  return prepCountThenComposeFrame(m);
}
