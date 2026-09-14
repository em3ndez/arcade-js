// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { loc_aa92 } from "./loc_aa92.js";
import { composeFrameDisplayList } from "./composeFrameDisplayList.js";

// Prime one draw slot, run the shared prep, then dispatch the per-frame driver.
export function loc_aa62(m) {
  drawSlotShapeWithHeader(m, 0x30, 0x00);
  loc_aa92(m);
  composeFrameDisplayList(m);
}
