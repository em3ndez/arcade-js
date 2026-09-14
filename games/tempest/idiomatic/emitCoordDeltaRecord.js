// SPDX-License-Identifier: GPL-3.0-only
import { PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, VEC_DELTA_Y_LO, DRAW_DELTA_A_HI, DRAW_DELTA_B_LO, DRAW_DELTA_B_HI, VG_RECORD_HEADER } from "./names.js";
import { emitCoordinateRecord } from "./emitCoordinateRecord.js";

// Store two 16-bit differences (current minus previous) into the delta slots, emit
// the record through the cursor, then latch current into previous and flag it ready.
export function emitCoordDeltaRecord(m) {
  const { mem8 } = m;
  const d0 = mem8[PROJ_Y_LO] - mem8[PREV_Y_LO];
  mem8[VEC_DELTA_Y_LO] = d0;
  mem8[DRAW_DELTA_A_HI] = mem8[PROJ_Y_HI] - mem8[PREV_Y_HI] - (d0 < 0 ? 1 : 0);
  const d1 = mem8[PROJ_X_LO] - mem8[PREV_X_LO];
  mem8[DRAW_DELTA_B_LO] = d1;
  mem8[DRAW_DELTA_B_HI] = mem8[PROJ_X_HI] - mem8[PREV_X_HI] - (d1 < 0 ? 1 : 0);
  emitCoordinateRecord(m, VEC_DELTA_Y_LO);
  mem8[PREV_Y_LO] = mem8[PROJ_Y_LO];
  mem8[PREV_Y_HI] = mem8[PROJ_Y_HI];
  mem8[PREV_X_LO] = mem8[PROJ_X_LO];
  mem8[PREV_X_HI] = mem8[PROJ_X_HI];
  mem8[VG_RECORD_HEADER] = 0xc0;
}
