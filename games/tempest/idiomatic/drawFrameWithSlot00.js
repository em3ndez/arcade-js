// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { drawSlotThenDigitRun } from "./drawSlotThenDigitRun.js";
import { composeFrameDisplayList } from "./composeFrameDisplayList.js";

/**
 * drawFrameWithSlot00 — compose a frame led by draw slot 0x00. ROM 0xaa62.
 *
 * Role in the machine: one of the small per-frame composition entry points Tempest dispatches to
 * depending on which display slot leads this frame's draw. This variant leads with slot 0x00 —
 * the player/overlay slot — priming it, running the shared count preparation, then handing off to
 * the common per-frame composition driver that stitches the finished vector list together.
 *
 * Behavior: primes slot 0x00 by drawing its shape record with header byte 0x30
 * (drawSlotShapeWithHeader), runs the shared count-then-digit preparation pass
 * (drawSlotThenDigitRun), then dispatches the per-frame composition loop (composeFrameDisplayList,
 * ROM loc_a8e7) that assembles the frame's display list.
 *
 * Live-out: the primed slot-0x00 record and the composed per-frame display list left by
 * composeFrameDisplayList for the vector generator. Grounding: [seen].
 */
export function drawFrameWithSlot00(m) {
  drawSlotShapeWithHeader(m, 0x30, 0x00); // prime slot 0x00 with header 0x30
  drawSlotThenDigitRun(m); // shared count / digit-run prep
  composeFrameDisplayList(m); // per-frame composition driver (loc_a8e7)
}
