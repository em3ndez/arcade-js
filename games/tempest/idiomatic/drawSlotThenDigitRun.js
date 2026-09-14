// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitCountDigitRun } from "./emitCountDigitRun.js";

// Draw the fixed slot, then hand off to the shared count-draw tail.
export function drawSlotThenDigitRun(m) {
  drawSlotShapeRecord(m, 0x02);
  return emitCountDigitRun(m);
}
