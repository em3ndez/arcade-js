// SPDX-License-Identifier: GPL-3.0-only
import { MODE_DISPATCH_SEL } from "./names.js";
import { drawFrame } from "./drawFrame.js";
import { buildVectorItemList } from "./buildVectorItemList.js";
import { drawMovingObjectSlots } from "./drawMovingObjectSlots.js";
import { drawScoreDeltaPanel } from "./drawScoreDeltaPanel.js";
import { drawTubeWell } from "./drawTubeWell.js";
import { seedRngAndDrawCounterPanel } from "./seedRngAndDrawCounterPanel.js";
import { drawFrameWithSlot00 } from "./drawFrameWithSlot00.js";
import { drawFrameWithSlot08 } from "./drawFrameWithSlot08.js";
import { composeFrameThenDrawSlot06 } from "./composeFrameThenDrawSlot06.js";
import { advanceSpreadingSpanAnimation } from "./advanceSpreadingSpanAnimation.js";
import { advancePinchingSpanAnimation } from "./advancePinchingSpanAnimation.js";
import { drawFrameWithSlot32 } from "./drawFrameWithSlot32.js";

// Computed-jump dispatcher (an RTS trampoline in the original): the pre-doubled selector picks one of
// twelve targets from a word table and runs it. Dissolved here into a direct table select.
const TABLE = [
  drawFrame, buildVectorItemList, drawMovingObjectSlots, drawScoreDeltaPanel, drawTubeWell, seedRngAndDrawCounterPanel,
  drawFrameWithSlot00, drawFrameWithSlot08, composeFrameThenDrawSlot06, advanceSpreadingSpanAnimation, advancePinchingSpanAnimation, drawFrameWithSlot32,
];

export function dispatchDisplayModeHandler(m) {
  return TABLE[m.mem8[MODE_DISPATCH_SEL] >> 1](m);
}
