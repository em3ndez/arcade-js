// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { prepCountThenComposeFrame } from "./prepCountThenComposeFrame.js";

/**
 * drawFrameWithSlot08 — compose a frame led by draw slot 0x08. ROM 0xaa5a.
 *
 * Role in the machine: a sibling of the other drawFrameWithSlotNN entry points — the per-frame
 * composition path taken when slot 0x08 (one of the object slots) leads this frame's draw. It
 * draws that slot's record, then chains straight into the shared prep-and-compose tail so the
 * rest of the frame's display list is built the same way as the other slot leaders.
 *
 * Behavior: draws slot 0x08's shape record (drawSlotShapeRecord), then tail-calls
 * prepCountThenComposeFrame — the combined count-preparation pass followed by the per-frame
 * composition driver (ROM loc_a8e7) — returning its result so the whole chain composes the frame.
 *
 * Live-out: the drawn slot-0x08 record and the composed per-frame display list produced by
 * prepCountThenComposeFrame for the vector generator. Grounding: [seen].
 */
export function drawFrameWithSlot08(m) {
  drawSlotShapeRecord(m, 0x08); // draw slot 0x08's shape record
  return prepCountThenComposeFrame(m); // count prep + per-frame composition (loc_a8e7)
}
