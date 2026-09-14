// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, VG_RECORD_HEADER, loc_9e } from "./names.js";
import { loc_df4c } from "./loc_df4c.js";
import { loadSlotCoordBlock } from "./loadSlotCoordBlock.js";
import { emitObjectPositionVector } from "./emitObjectPositionVector.js";
import { emitProjectedSlotRecord } from "./emitProjectedSlotRecord.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";

// Draw a framed element in two passes: emit the current slot with the colour live,
// step back one slot and re-emit uncoloured, then restore the colour and close it.
// Returns the stepped-back slot index.
export function loc_c3ee(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  const color = a;
  mem8[SLOT_LOOP_INDEX] = x;
  loc_df4c(m, 0x08, mem8[loc_9e]);
  loadSlotCoordBlock(m);
  emitObjectPositionVector(m, 0x61);
  mem8[VG_RECORD_HEADER] = color;
  emitProjectedSlotRecord(m);
  mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
  mem8[VG_RECORD_HEADER] = 0x00;
  loc_df4c(m, 0x08, mem8[loc_9e]);
  emitProjectedSlotRecord(m);
  mem8[VG_RECORD_HEADER] = color;
  loadSlotCoordBlock(m);
  emitCoordDeltaRecord(m);
  return mem8[SLOT_LOOP_INDEX];
}
