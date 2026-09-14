// SPDX-License-Identifier: GPL-3.0-only
import { PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, VEC_DELTA_Y_LO, DRAW_DELTA_A_HI, DRAW_DELTA_B_LO, DRAW_DELTA_B_HI, VG_RECORD_HEADER } from "./names.js";
import { emitCoordinateRecord } from "./emitCoordinateRecord.js";

/**
 * emitCoordDeltaRecord — emit a screen point as a 16-bit delta from the previous point. ROM 0xc3ba.
 *
 * Role in the machine: Tempest's vector display list draws object shapes as chains of relative moves, so
 * each new projected point is expressed as its 16-bit difference from the last point the beam visited. This
 * routine (used by the moving-object cascade, e.g. drawMovingObjectSlots) computes that difference on both
 * axes, emits the stroke, and rolls the "previous point" forward for the next call.
 *
 * Behavior: form the Y delta as the two-byte subtraction PROJ_Y (0x61/0x62) minus PREV_Y (0x6a/0x6b),
 * writing the low byte to VEC_DELTA_Y_LO (0x6e) and the high byte to DRAW_DELTA_A_HI with an explicit borrow
 * when the low subtraction went negative (the 6502 SBC carry chain). Do the same for X: PROJ_X (0x63/0x64)
 * minus PREV_X (0x6c/0x6d) into DRAW_DELTA_B_LO/HI (0x70/0x71) with its own borrow. emitCoordinateRecord
 * then appends the four-byte delta record starting at VEC_DELTA_Y_LO. Finally latch the current projected
 * point (all four bytes) into the PREV_* cells and set the record header VG_RECORD_HEADER (0x73) to 0xc0.
 *
 * Live-out: the delta slots 0x6e-0x71 hold this stroke's signed 16-bit deltas; PREV_Y/PREV_X (0x6a-0x6d)
 * now hold the current point for the next delta; VG_RECORD_HEADER = 0xc0; one coordinate record is appended
 * to the display list. Grounding: [seen].
 */
// Store two 16-bit differences (current minus previous) into the delta slots, emit
// the record through the cursor, then latch current into previous and flag it ready.
export function emitCoordDeltaRecord(m) {
  const { mem8 } = m;
  const d0 = mem8[PROJ_Y_LO] - mem8[PREV_Y_LO];   // Y low-byte delta
  mem8[VEC_DELTA_Y_LO] = d0;
  mem8[DRAW_DELTA_A_HI] = mem8[PROJ_Y_HI] - mem8[PREV_Y_HI] - (d0 < 0 ? 1 : 0); // borrow from low
  const d1 = mem8[PROJ_X_LO] - mem8[PREV_X_LO];   // X low-byte delta
  mem8[DRAW_DELTA_B_LO] = d1;
  mem8[DRAW_DELTA_B_HI] = mem8[PROJ_X_HI] - mem8[PREV_X_HI] - (d1 < 0 ? 1 : 0); // borrow from low
  emitCoordinateRecord(m, VEC_DELTA_Y_LO);        // append the 4-byte delta record
  mem8[PREV_Y_LO] = mem8[PROJ_Y_LO];              // roll current point -> previous, for the next delta
  mem8[PREV_Y_HI] = mem8[PROJ_Y_HI];
  mem8[PREV_X_LO] = mem8[PROJ_X_LO];
  mem8[PREV_X_HI] = mem8[PROJ_X_HI];
  mem8[VG_RECORD_HEADER] = 0xc0;                  // 0xc0 = coordinate-record header/opcode
}
