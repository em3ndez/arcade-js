// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_METRIC, loc_601 } from "./names.js";
import { sharedReturnTail } from "./sharedReturnTail.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitCappedCount } from "./emitCappedCount.js";
import { drawCounterSlot } from "./drawCounterSlot.js";

// When either counter byte is live, draw a shared header, its count, and both counter slots.
export function drawCounterPair(m) {
  const { mem8 } = m;
  if ((mem8[SLOT_METRIC] | mem8[loc_601]) === 0) return sharedReturnTail();
  drawSlotShapeRecord(m, 0x12);
  emitCappedCount(m, 0x63);
  drawCounterSlot(m, 0x00);
  return drawCounterSlot(m, 0x01);
}
