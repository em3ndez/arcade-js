// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_73, loc_414, loc_608c, loc_608e, loc_608f, loc_6090, loc_6094,
  loc_6040, loc_6060, loc_6070,
} from "./names.js";

// Prime the math coprocessor's operand and count registers from A and X, kick
// off its divide, then scan a 16-step window for the first ready slot and hand
// back that slot's low/high result pair (or exit with the counter run past end).
export function loc_dce6(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  let y = 0x00;
  mem8[loc_73] = 0x00;
  mem8[loc_414] = 0x00;
  mem8[loc_608e] = a;
  mem8[loc_608f] = x;
  mem8[loc_6090] = 0x00;
  mem8[loc_608c] = 0x10;
  mem8[loc_6094] = 0x10;
  for (x = 0x10; ; ) {
    x = u8(x - 1);
    if (x & 0x80) break;
    a = mem8[loc_6040];
    if (a & 0x80) continue;
    a = mem8[loc_6060];
    y = mem8[loc_6070];
    break;
  }
  return [(m.regs.a = a & 0xff), (m.regs.x = x & 0xff), (m.regs.y = y & 0xff)];
}
