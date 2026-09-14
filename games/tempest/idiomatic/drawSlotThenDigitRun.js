// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitCountDigitRun } from "./emitCountDigitRun.js";

/**
 * drawSlotThenDigitRun — shared count-prep entry: draw fixed slot 0x02, then lay the digit run. ROM 0xaa92.
 *
 * Role in the machine: several of the per-frame composition entries (drawFrameWithSlot00 0xaa62,
 * prepCountThenComposeFrame 0xaa69) need the same two-step preamble before dispatching the frame
 * body — render one specific object slot, then emit the numeric run that reports a count. This is
 * that shared preamble factored into one routine so the callers can tail-call it.
 *
 * Behavior: render object record for the fixed slot index 0x02 via drawSlotShapeRecord (its header
 * seed comes from ROM, not an argument), then tail-hand to emitCountDigitRun which lays down the
 * numeric digit run into the display list. The emitCountDigitRun result is returned unchanged.
 *
 * Live-out: whatever the two callees write — the display list grown by slot 0x02's record and by
 * the digit run, plus their shared cursor/scratch cells (loc_74 cursor, loc_2a/loc_2b, etc.).
 * Grounding: [seen]
 */
export function drawSlotThenDigitRun(m) {
  drawSlotShapeRecord(m, 0x02);   // render the fixed slot-0x02 object record (ROM header seed)
  return emitCountDigitRun(m);    // then lay the numeric digit run; pass its result through
}
