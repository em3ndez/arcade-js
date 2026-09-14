// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_METRIC, loc_601 } from "./names.js";
import { sharedReturnTail } from "./sharedReturnTail.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { loc_af71 } from "./loc_af71.js";
import { loc_af3f } from "./loc_af3f.js";

// When either counter byte is live, draw a shared header, its count, and both counter slots.
export function loc_af26(m) {
  const { mem8 } = m;
  if ((mem8[SLOT_METRIC] | mem8[loc_601]) === 0) return sharedReturnTail();
  drawSlotShapeRecord(m, 0x12);
  loc_af71(m, 0x63);
  loc_af3f(m, 0x00);
  return loc_af3f(m, 0x01);
}
