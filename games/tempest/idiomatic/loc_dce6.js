// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  VG_RECORD_HEADER, loc_414, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_HI, MATHBOX_LD_RB_LO, MATHBOX_LD_RB_HI, MATHBOX_DIVIDE,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI,
} from "./names.js";

// Prime the math coprocessor's operand and count registers from A and X, kick
// off its divide, then scan a 16-step window for the first ready slot and hand
// back that slot's low/high result pair (or exit with the counter run past end).
export function loc_dce6(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  let y = 0x00;
  mem8[VG_RECORD_HEADER] = 0x00;
  mem8[loc_414] = 0x00;
  mem8[MATHBOX_LD_RA_HI] = a;
  mem8[MATHBOX_LD_RB_LO] = x;
  mem8[MATHBOX_LD_RB_HI] = 0x00;
  mem8[MATHBOX_LD_R6_COUNT] = 0x10;
  mem8[MATHBOX_DIVIDE] = 0x10;
  for (x = 0x10; ; ) {
    x = u8(x - 1);
    if (x & 0x80) break;
    a = mem8[MATHBOX_STATUS];
    if (a & 0x80) continue;
    a = mem8[MATHBOX_RESULT_LO];
    y = mem8[MATHBOX_RESULT_HI];
    break;
  }
  return [(m.regs.a = a & 0xff), (m.regs.x = x & 0xff), (m.regs.y = y & 0xff)];
}
