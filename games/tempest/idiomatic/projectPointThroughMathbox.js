// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_32, MATHBOX_SIGN_X, MATHBOX_SIGN_Y, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, PROJ_Y_REF, DEPTH_HI, PROJ_X_REF,
  PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PROJ_OFS_Y_LO, PROJ_OFS_Y_HI, PROJ_OFS_X_LO, PROJ_OFS_X_HI,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_RA_HI, MATHBOX_DIVIDE, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";

/**
 * projectPointThroughMathbox -- project one tube-space point into a screen-coordinate pair. ROM 0xc098.
 *
 * Role in the machine: Tempest offloads its perspective math to a hardware "math box" coprocessor. To
 * draw the tube it must repeatedly turn a point given as (depth, X, Y) in tube space into an (X,Y) screen
 * position; every lane corner, enemy, and shot passes through here. This routine feeds the math box the
 * signed deltas it needs, spins on its busy flag while it divides, then folds the returned coordinate
 * into a pair of 16-bit accumulators with saturating (signed overflow-clamped) add/subtract.
 *
 * Behavior: first it forms a 16-bit depth difference from OBJ_DEPTH/DEPTH_HI ($57/$5f) with borrow into
 * the high byte from DEPTH_LO ($5b); a negative depth is clamped up to +1 (0x0001) before being loaded
 * into the math box's R7 register (MATHBOX_LD_R7_LO/HI). It then computes |dx| and its sign from
 * PROJ_PT_X/PROJ_X_REF ($58/$60), loading the magnitude into the divide/RA ports and stashing the sign in
 * MATHBOX_SIGN_X; likewise |dy| and its sign from PROJ_PT_Y/PROJ_Y_REF ($56/$5e) into loc_32 and
 * MATHBOX_SIGN_Y. It spins on MATHBOX_STATUS bit 7 until the coprocessor finishes, reads the result into
 * the X accumulator (PROJ_X_LO/HI), reloads the box with the dy magnitude, and folds the X offset pair
 * PROJ_OFS_X_LO/HI ($68/$69) into PROJ_X ($63/$64) -- subtracting when MATHBOX_SIGN_X is negative, adding
 * otherwise, and pinning to 0x8000 / 0x7fff on signed overflow. A second wait reads the next result into
 * PROJ_Y_LO/HI and folds the Y offset pair PROJ_OFS_Y_LO/HI ($66/$67) into PROJ_Y ($61/$62) the same way.
 *
 * Live-out: the two projected accumulators PROJ_X_LO/HI and PROJ_Y_LO/HI, the sign cells MATHBOX_SIGN_X/Y,
 * loc_32, and the math-box hardware registers left loaded. Grounding: [seen].
 */
export function projectPointThroughMathbox(m) {
  const { mem8 } = m;

  // 16-bit difference; a negative result clamps up to +1.
  const deltaLo = mem8[OBJ_DEPTH] - mem8[DEPTH_HI];      // low-byte depth delta ($57 - $5f)
  const cfA = deltaLo >= 0 ? 1 : 0;                      // carry (no borrow) out of the low byte
  mem8[MATHBOX_LD_R7_LO] = deltaLo;                      // load R7 low
  const deltaHi = (0 - mem8[DEPTH_LO] - (1 - cfA)) & 0xff; // high byte with borrow from $5b
  mem8[MATHBOX_LD_R7_HI] = deltaHi;                      // load R7 high
  if (deltaHi & 0x80) {                                  // negative depth -> clamp to +1
    mem8[MATHBOX_LD_R7_HI] = 0x00;
    mem8[MATHBOX_LD_R7_LO] = 0x01;
  }

  // |dx| and its sign.
  const b58 = mem8[PROJ_PT_X], b60 = mem8[PROJ_X_REF];   // point X and its reference ($58/$60)
  const dxAbs = (b58 < b60 ? b60 - b58 : b58 - b60) & 0xff; // magnitude
  const dxSign = b58 < b60 ? 0xff : 0x00;                // sign (0xff = negative)
  mem8[MATHBOX_LD_RA_HI] = dxAbs;                        // magnitude -> RA / divide ports
  mem8[MATHBOX_DIVIDE] = dxAbs;
  mem8[MATHBOX_SIGN_X] = dxSign;                         // stash sign for the fold below

  // |dy| and its sign.
  const b56 = mem8[PROJ_PT_Y], b5e = mem8[PROJ_Y_REF];   // point Y and its reference ($56/$5e)
  const dyAbs = (b56 < b5e ? b5e - b56 : b56 - b5e) & 0xff;
  const dySign = b56 < b5e ? 0xff : 0x00;
  mem8[loc_32] = dyAbs;                                  // hold dy magnitude for the second pass
  mem8[MATHBOX_SIGN_Y] = dySign;

  while (mem8[MATHBOX_STATUS] & 0x80) {} // wait for the coprocessor

  // First accumulator: fold the dy offset pair in or out.
  mem8[PROJ_X_LO] = mem8[MATHBOX_RESULT_LO];             // read the divide result
  mem8[PROJ_X_HI] = mem8[MATHBOX_RESULT_HI];
  mem8[MATHBOX_LD_RA_HI] = mem8[loc_32];                 // kick off the dy divide
  mem8[MATHBOX_DIVIDE] = mem8[loc_32];
  if (mem8[MATHBOX_SIGN_X] & 0x80) {                     // negative sign -> subtract the offset pair
    const lo = mem8[PROJ_OFS_X_LO] - mem8[PROJ_X_LO];
    const cf = lo >= 0 ? 1 : 0;
    mem8[PROJ_X_LO] = lo;
    const A = mem8[PROJ_OFS_X_HI], v = mem8[PROJ_X_HI], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_X_LO] = 0x00; mem8[PROJ_X_HI] = 0x80; } // clamp to -32768
    else mem8[PROJ_X_HI] = res;
  } else {                                               // positive sign -> add the offset pair
    const sumLo = mem8[PROJ_X_LO] + mem8[PROJ_OFS_X_LO];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[PROJ_X_LO] = sumLo;
    const A = mem8[PROJ_X_HI], v = mem8[PROJ_OFS_X_HI], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_X_LO] = 0xff; mem8[PROJ_X_HI] = 0x7f; } // clamp to +32767
    else mem8[PROJ_X_HI] = res;
  }

  while (mem8[MATHBOX_STATUS] & 0x80) {} // wait for the coprocessor

  // Second accumulator: fold the dx offset pair in or out.
  mem8[PROJ_Y_LO] = mem8[MATHBOX_RESULT_LO];             // read the dy divide result
  mem8[PROJ_Y_HI] = mem8[MATHBOX_RESULT_HI];
  if (mem8[MATHBOX_SIGN_Y] & 0x80) {                     // negative sign -> subtract
    const lo = mem8[PROJ_OFS_Y_LO] - mem8[PROJ_Y_LO];
    const cf = lo >= 0 ? 1 : 0;
    mem8[PROJ_Y_LO] = lo;
    const A = mem8[PROJ_OFS_Y_HI], v = mem8[PROJ_Y_HI], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_Y_LO] = 0x00; mem8[PROJ_Y_HI] = 0x80; } // clamp to -32768
    else mem8[PROJ_Y_HI] = res;
  } else {                                               // positive sign -> add
    const sumLo = mem8[PROJ_Y_LO] + mem8[PROJ_OFS_Y_LO];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[PROJ_Y_LO] = sumLo;
    const A = mem8[PROJ_Y_HI], v = mem8[PROJ_OFS_Y_HI], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[PROJ_Y_LO] = 0xff; mem8[PROJ_Y_HI] = 0x7f; } // clamp to +32767
    else mem8[PROJ_Y_HI] = res;
  }
}
