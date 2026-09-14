// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_32, MATHBOX_SIGN_X, MATHBOX_SIGN_Y, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, PROJ_Y_REF, DEPTH_HI, PROJ_X_REF,
  PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PROJ_OFS_Y_LO, PROJ_OFS_Y_HI, PROJ_OFS_X_LO, PROJ_OFS_X_HI,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_RA_HI, MATHBOX_DIVIDE, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";

// Compute clamped signed X/Y deltas into the math coprocessor, wait for each result, then add or
// subtract paired offsets into two 16-bit accumulators with saturating limits.
export function projectPointThroughMathbox(m) {
  const { mem8 } = m;

  // 16-bit difference; a negative result clamps up to +1.
  const deltaLo = mem8[OBJ_DEPTH] - mem8[DEPTH_HI];
  const cfA = deltaLo >= 0 ? 1 : 0;
  mem8[MATHBOX_LD_R7_LO] = deltaLo;
  const deltaHi = (0 - mem8[DEPTH_LO] - (1 - cfA)) & 0xff;
  mem8[MATHBOX_LD_R7_HI] = deltaHi;
  if (deltaHi & 0x80) {
    mem8[MATHBOX_LD_R7_HI] = 0x00;
    mem8[MATHBOX_LD_R7_LO] = 0x01;
  }

  // |dx| and its sign.
  const b58 = mem8[PROJ_PT_X], b60 = mem8[PROJ_X_REF];
  const dxAbs = (b58 < b60 ? b60 - b58 : b58 - b60) & 0xff;
  const dxSign = b58 < b60 ? 0xff : 0x00;
  mem8[MATHBOX_LD_RA_HI] = dxAbs;
  mem8[MATHBOX_DIVIDE] = dxAbs;
  mem8[MATHBOX_SIGN_X] = dxSign;

  // |dy| and its sign.
  const b56 = mem8[PROJ_PT_Y], b5e = mem8[PROJ_Y_REF];
  const dyAbs = (b56 < b5e ? b5e - b56 : b56 - b5e) & 0xff;
  const dySign = b56 < b5e ? 0xff : 0x00;
  mem8[loc_32] = dyAbs;
  mem8[MATHBOX_SIGN_Y] = dySign;

  while (mem8[MATHBOX_STATUS] & 0x80) {} // wait for the coprocessor

  // First accumulator: fold the dy offset pair in or out.
  mem8[PROJ_X_LO] = mem8[MATHBOX_RESULT_LO];
  mem8[PROJ_X_HI] = mem8[MATHBOX_RESULT_HI];
  mem8[MATHBOX_LD_RA_HI] = mem8[loc_32];
  mem8[MATHBOX_DIVIDE] = mem8[loc_32];
  if (mem8[MATHBOX_SIGN_X] & 0x80) {
    const lo = mem8[PROJ_OFS_X_LO] - mem8[PROJ_X_LO];
    const cf = lo >= 0 ? 1 : 0;
    mem8[PROJ_X_LO] = lo;
    const A = mem8[PROJ_OFS_X_HI], v = mem8[PROJ_X_HI], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_X_LO] = 0x00; mem8[PROJ_X_HI] = 0x80; }
    else mem8[PROJ_X_HI] = res;
  } else {
    const sumLo = mem8[PROJ_X_LO] + mem8[PROJ_OFS_X_LO];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[PROJ_X_LO] = sumLo;
    const A = mem8[PROJ_X_HI], v = mem8[PROJ_OFS_X_HI], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_X_LO] = 0xff; mem8[PROJ_X_HI] = 0x7f; }
    else mem8[PROJ_X_HI] = res;
  }

  while (mem8[MATHBOX_STATUS] & 0x80) {} // wait for the coprocessor

  // Second accumulator: fold the dx offset pair in or out.
  mem8[PROJ_Y_LO] = mem8[MATHBOX_RESULT_LO];
  mem8[PROJ_Y_HI] = mem8[MATHBOX_RESULT_HI];
  if (mem8[MATHBOX_SIGN_Y] & 0x80) {
    const lo = mem8[PROJ_OFS_Y_LO] - mem8[PROJ_Y_LO];
    const cf = lo >= 0 ? 1 : 0;
    mem8[PROJ_Y_LO] = lo;
    const A = mem8[PROJ_OFS_Y_HI], v = mem8[PROJ_Y_HI], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_Y_LO] = 0x00; mem8[PROJ_Y_HI] = 0x80; }
    else mem8[PROJ_Y_HI] = res;
  } else {
    const sumLo = mem8[PROJ_Y_LO] + mem8[PROJ_OFS_Y_LO];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[PROJ_Y_LO] = sumLo;
    const A = mem8[PROJ_Y_HI], v = mem8[PROJ_OFS_Y_HI], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_Y_LO] = 0xff; mem8[PROJ_Y_HI] = 0x7f; }
    else mem8[PROJ_Y_HI] = res;
  }
}
