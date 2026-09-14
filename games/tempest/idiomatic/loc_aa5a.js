// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { loc_aa69 } from "./loc_aa69.js";

// Draw one object slot, then run the shared post-draw step.
export function loc_aa5a(m) {
  drawSlotShapeRecord(m, 0x08);
  return loc_aa69(m);
}
