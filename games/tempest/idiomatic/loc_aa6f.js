// SPDX-License-Identifier: GPL-3.0-only
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";

// Run the alternate prep, then prime a draw slot through the shared entry.
export function loc_aa6f(m) {
  buildTextOverlayList(m);
  drawSlotShapeWithHeader(m, 0x00, 0x06);
}
