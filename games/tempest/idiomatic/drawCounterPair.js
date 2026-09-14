// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_METRIC, loc_601 } from "./names.js";
import { sharedReturnTail } from "./sharedReturnTail.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitCappedCount } from "./emitCappedCount.js";
import { drawCounterSlot } from "./drawCounterSlot.js";

/**
 * drawCounterPair — draw the two-slot counter panel when either counter is live. ROM 0xaf26.
 *
 * Role in the machine: the display list carries a small paired readout backed by two counter bytes,
 * loc_600 (SLOT_METRIC) and loc_601. When both are zero the panel is empty and nothing should be drawn;
 * when either holds a nonzero count the whole panel is emitted — a shared header record, a capped header
 * count, and then each of the two counter slots in turn. This routine is that all-or-nothing guard plus
 * the panel's fixed draw sequence.
 *
 * Behaviour: OR the two counter bytes; if the result is zero the panel is inactive, so return through the
 * shared bare tail (loc_af6e) without emitting anything. Otherwise emit the shared header shape record
 * (drawSlotShapeRecord 0x12), the header's capped count (emitCappedCount 0x63), and then draw slot 0 and
 * slot 1 via drawCounterSlot — the slot-1 call is tail-returned.
 *
 * Live-out: appends the header + both slots' vector records to the active display list (via the draw
 * helpers); reads but does not write the counter bytes loc_600/loc_601. Grounding: [seen].
 */
export function drawCounterPair(m) {
  const { mem8 } = m;
  // Panel is empty when both counter bytes are zero -> return through the shared bare tail, drawing nothing.
  if ((mem8[SLOT_METRIC] | mem8[loc_601]) === 0) return sharedReturnTail();
  drawSlotShapeRecord(m, 0x12);   // shared header shape record
  emitCappedCount(m, 0x63);       // header count, capped at 0x63
  drawCounterSlot(m, 0x00);       // counter slot 0
  return drawCounterSlot(m, 0x01); // counter slot 1 (tail-returned)
}
