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

/**
 * dispatchDisplayModeHandler -- run the display-mode draw handler chosen by the mode cell. ROM 0xb20d.
 *
 * Role in the machine: this is the computed-jump trampoline that the per-frame vector housekeeping
 * (buildFrameVectors) turns on to draw whatever the machine is currently showing -- the attract screens,
 * the readout panels, the animated tube, the moving-object slots, and so on. Tempest's display state is a
 * small mode number, and each mode has its own routine that emits the correct vector list for that frame.
 *
 * Behavior: the mode cell MODE_DISPATCH_SEL (0x1) holds a pre-doubled selector (an even byte offset into a
 * 2-byte-per-entry word table). The routine picks TABLE[selector>>1] -- one of twelve display-mode targets:
 * drawFrame (the general frame builder), buildVectorItemList, drawMovingObjectSlots, drawScoreDeltaPanel,
 * drawTubeWell, seedRngAndDrawCounterPanel, the fixed-slot frame variants (slot 00/08/06/32), and the two
 * span animations (spreading/pinching) -- and tail-calls it, returning its result to this routine's own
 * caller. The original's RTS-trampoline word table is dissolved here into a direct table select.
 *
 * Live-out: whatever vector-list / display state the selected handler emits; no state of its own.
 * Grounding: [seen].
 */
const TABLE = [
  drawFrame, buildVectorItemList, drawMovingObjectSlots, drawScoreDeltaPanel, drawTubeWell, seedRngAndDrawCounterPanel,
  drawFrameWithSlot00, drawFrameWithSlot08, composeFrameThenDrawSlot06, advanceSpreadingSpanAnimation, advancePinchingSpanAnimation, drawFrameWithSlot32,
];

export function dispatchDisplayModeHandler(m) {
  return TABLE[m.mem8[MODE_DISPATCH_SEL] >> 1](m);
}
