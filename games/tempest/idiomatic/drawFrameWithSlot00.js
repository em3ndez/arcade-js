// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { drawSlotThenDigitRun } from "./drawSlotThenDigitRun.js";
import { composeFrameDisplayList } from "./composeFrameDisplayList.js";

// Prime one draw slot, run the shared prep, then dispatch the per-frame driver.
export function drawFrameWithSlot00(m) {
  drawSlotShapeWithHeader(m, 0x30, 0x00);
  drawSlotThenDigitRun(m);
  composeFrameDisplayList(m);
}
