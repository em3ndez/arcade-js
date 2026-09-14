// SPDX-License-Identifier: GPL-3.0-only
import { MODE_DISPATCH_SEL } from "./names.js";
import { loc_b230 } from "./loc_b230.js";
import { buildVectorItemList } from "./buildVectorItemList.js";
import { drawMovingObjectSlots } from "./drawMovingObjectSlots.js";
import { loc_adea } from "./loc_adea.js";
import { drawTubeWell } from "./drawTubeWell.js";
import { seedRngAndDrawCounterPanel } from "./seedRngAndDrawCounterPanel.js";
import { loc_aa62 } from "./loc_aa62.js";
import { loc_aa5a } from "./loc_aa5a.js";
import { loc_aa6f } from "./loc_aa6f.js";
import { advanceSpreadingSpanAnimation } from "./advanceSpreadingSpanAnimation.js";
import { advancePinchingSpanAnimation } from "./advancePinchingSpanAnimation.js";
import { loc_aa79 } from "./loc_aa79.js";

// Computed-jump dispatcher (an RTS trampoline in the original): the pre-doubled selector picks one of
// twelve targets from a word table and runs it. Dissolved here into a direct table select.
const TABLE = [
  loc_b230, buildVectorItemList, drawMovingObjectSlots, loc_adea, drawTubeWell, seedRngAndDrawCounterPanel,
  loc_aa62, loc_aa5a, loc_aa6f, advanceSpreadingSpanAnimation, advancePinchingSpanAnimation, loc_aa79,
];

export function loc_b20d(m) {
  return TABLE[m.mem8[MODE_DISPATCH_SEL] >> 1](m);
}
