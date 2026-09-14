// SPDX-License-Identifier: GPL-3.0-only
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";

/**
 * composeFrameThenDrawSlot06 — alternate per-frame composition, then draw slot 0x06. ROM 0xaa6f.
 *
 * Role in the machine: one of Tempest's per-frame display-list builders, the variant used on the screens
 * that lead with text (the alternate composition at loc_a8b4 assembles that overlay). After the text list is
 * laid down it appends one more shape record — slot 0x06 — through the shared slot-drawing entry with a zero
 * header byte. A thin two-step sequencer with no branching of its own.
 *
 * Behavior: call buildTextOverlayList (loc_a8b4) to build the alternate frame, then drawSlotShapeWithHeader
 * with header 0x00 and slot index 0x06 to emit that shape into the display list.
 *
 * Live-out: appends to the current frame's display list via the two callees. Grounding: [seen].
 */
export function composeFrameThenDrawSlot06(m) {
  buildTextOverlayList(m);              // alternate per-frame composition (loc_a8b4)
  drawSlotShapeWithHeader(m, 0x00, 0x06); // then prime slot 0x06 through the shared entry, header 0x00
}
