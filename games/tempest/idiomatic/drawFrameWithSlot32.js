// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_COUNTER } from "./names.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";

/**
 * drawFrameWithSlot32 — compose a frame led by draw slot 0x32, with a blinking second slot. ROM 0xaa79.
 *
 * Role in the machine: another per-frame composition entry point, this one leading with slot 0x32.
 * Its distinguishing feature is a phase-gated second draw: it conditionally adds slot 0x22 only
 * during the low half of a frame-counter cycle, which makes that element blink on and off across
 * frames (a common Tempest attract/UI flourish). It then finishes through the text-overlay path.
 *
 * Behavior: draws slot 0x32's shape record with header byte 0x00 (drawSlotShapeWithHeader). Then,
 * while the low 5 bits of FRAME_COUNTER (loc_3 & 0x1f) are below 0x10 — i.e. the first 16 of every
 * 32 frames — it also draws slot 0x22 with header 0xe0, giving that element a 50% duty-cycle blink.
 * Finally it tail-calls buildTextOverlayList (ROM loc_a8b4) to lay in the text overlay and finish.
 *
 * Live-out: the drawn slot-0x32 record, the optionally-drawn slot-0x22 record, and the text overlay
 * list left by buildTextOverlayList for the vector generator. Grounding: [seen].
 */
export function drawFrameWithSlot32(m) {
  const { mem8 } = m;
  drawSlotShapeWithHeader(m, 0x00, 0x32); // lead slot 0x32, header 0x00
  // Phase-gated blink: draw slot 0x22 only in the low half (< 0x10) of the 32-frame counter cycle.
  if ((mem8[FRAME_COUNTER] & 0x1f) < 0x10) drawSlotShapeWithHeader(m, 0xe0, 0x22);
  return buildTextOverlayList(m); // finish via the text-overlay path (loc_a8b4)
}
