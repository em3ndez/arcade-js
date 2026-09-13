// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_29, loc_2a, loc_31, SLOT_LOOP_INDEX, TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X,
  TIMER2_LO, TIMER2_MID, TIMER2_HI, COORD_ACC_LO, COORD_ACC_HI, DIGIT_IN_LO, DIGIT_IN_HI, DIV_QUOTIENT, DIV_REMAINDER,
  MATHBOX_LD_RA_LO, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";
import { loc_dce6 } from "./loc_dce6.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_dfb1 } from "./loc_dfb1.js";
import { loc_df75 } from "./loc_df75.js";

// Packed-decimal add of two little-endian input pairs -- the first also doubled --
// forced to a minimum of one, then five passes of binary-to-BCD double-dabble over the
// three-byte source the running pointer walks, emitting each pass's converted digits.
function addDecimal(a, v, carryIn) {
  let al = (a & 0x0f) + (v & 0x0f) + (carryIn ? 1 : 0);
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum > 0xff];
}

export function loc_dd41(m) {
  const { mem8, mem16 } = m;
  const carryHi = mem8[DIGIT_IN_LO] & 0x80 ? 1 : 0;
  mem8[loc_29] = mem8[DIGIT_IN_LO] << 1;
  mem8[loc_2a] = (mem8[DIGIT_IN_HI] << 1) | carryHi;
  const lo = mem8[COORD_ACC_LO] + mem8[loc_29];
  mem8[MATHBOX_LD_R7_LO] = lo;
  mem8[loc_29] = lo;
  const hi = mem8[COORD_ACC_HI] + mem8[loc_2a] + (lo > 0xff ? 1 : 0);
  mem8[MATHBOX_LD_R7_HI] = hi;
  if (((hi & 0xff) | mem8[loc_29]) === 0) mem8[MATHBOX_LD_R7_LO] = 0x01;
  mem8[MATHBOX_LD_RA_LO] = mem8[TIMER2_LO];
  const [q, , r] = loc_dce6(m, mem8[TIMER2_MID], mem8[TIMER2_HI]);
  mem8[DIV_QUOTIENT] = q;
  mem8[DIV_REMAINDER] = r;
  loc_df39(m, 0x3d, 0xce);
  mem8[WORK_PTR_LO] = 0x06;
  mem8[WORK_PTR_HI] = 0x04;
  mem8[SLOT_LOOP_INDEX] = 0x04;
  do {
    mem8[loc_31] = 0x00;
    mem8[loc_31 + 1] = 0x00;
    mem8[loc_31 + 2] = 0x00;
    mem8[loc_31 + 3] = 0x00;
    mem8[PROJ_PT_Y] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    mem8[OBJ_DEPTH] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    mem8[PROJ_PT_X] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    let carry = false;
    mem8[TABLE_CURSOR] = 0x17;
    do {
      let shifted = (mem8[PROJ_PT_Y] << 1) | (carry ? 1 : 0);
      carry = (mem8[PROJ_PT_Y] & 0x80) !== 0;
      mem8[PROJ_PT_Y] = shifted;
      shifted = (mem8[OBJ_DEPTH] << 1) | (carry ? 1 : 0);
      carry = (mem8[OBJ_DEPTH] & 0x80) !== 0;
      mem8[OBJ_DEPTH] = shifted;
      shifted = (mem8[PROJ_PT_X] << 1) | (carry ? 1 : 0);
      carry = (mem8[PROJ_PT_X] & 0x80) !== 0;
      mem8[PROJ_PT_X] = shifted;
      for (let d = 0; d <= 3; d++) {
        const [sum, out] = addDecimal(mem8[loc_31 + d], mem8[loc_31 + d], carry);
        mem8[loc_31 + d] = sum;
        carry = out;
      }
      mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
    } while ((mem8[TABLE_CURSOR] & 0x80) === 0);
    loc_dfb1(m, 0x31, 0x04);
    loc_df75(m, 0xd0, 0xf8);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while ((mem8[SLOT_LOOP_INDEX] & 0x80) === 0);
}
