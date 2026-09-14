// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI } from "./names.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";

// Snapshot four indexed table cells into the record header, then emit the record.
export function emitProjectedSlotRecord(m) {
  const { mem8 } = m;
  const x = mem8[SLOT_LOOP_INDEX];
  mem8[PROJ_Y_LO] = mem8[u16(COL_SUB_A + x)];
  mem8[PROJ_Y_HI] = mem8[u16(COL_VAL_A + x)];
  mem8[PROJ_X_LO] = mem8[u16(COL_SUB_B + x)];
  mem8[PROJ_X_HI] = mem8[u16(COL_VAL_B + x)];
  return emitCoordDeltaRecord(m);
}
