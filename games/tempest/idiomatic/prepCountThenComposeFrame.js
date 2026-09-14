// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotThenDigitRun } from "./drawSlotThenDigitRun.js";
import { composeFrameDisplayList } from "./composeFrameDisplayList.js";

/**
 * prepCountThenComposeFrame -- run the per-frame count prep, then build the frame's display list. ROM 0xaa69.
 *
 * Role in the machine: this is the small head of one of Tempest's frame composers. Before the vector
 * display list for a frame can be assembled, the shared "count prep" has to run: it draws the fixed
 * slot-0x02 record and the digit run (score / bonus / diagnostic digits) that every frame carries. With
 * that prep laid down, control chains into the per-frame composition body (loc_a8e7) that walks the
 * object tables and emits the rest of the frame's vectors.
 *
 * Behavior: unconditionally calls drawSlotThenDigitRun(m) to emit the slot-0x02 shape plus the digit run,
 * then falls straight through into composeFrameDisplayList(m) which is the decompiled loc_a8e7 driver.
 * There are no branches and no locals of its own -- it is purely a two-step sequencer that keeps the
 * count-prep and the composition wired in the ROM's fixed order.
 *
 * Live-out: whatever the two callees write -- the growing display list and their working cells; this
 * routine adds no state of its own. Grounding: [seen].
 */
export function prepCountThenComposeFrame(m) {
  drawSlotThenDigitRun(m);      // count prep: slot 0x02 record + the digit run
  composeFrameDisplayList(m);   // per-frame composition body (loc_a8e7)
}
