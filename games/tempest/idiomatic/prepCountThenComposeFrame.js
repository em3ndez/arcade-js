// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotThenDigitRun } from "./drawSlotThenDigitRun.js";
import { composeFrameDisplayList } from "./composeFrameDisplayList.js";

// Run the shared prep, then dispatch the per-frame driver.
export function prepCountThenComposeFrame(m) {
  drawSlotThenDigitRun(m);
  composeFrameDisplayList(m);
}
