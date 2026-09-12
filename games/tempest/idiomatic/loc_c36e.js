// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_37, loc_38, loc_61, loc_62, loc_63, loc_64, loc_73, loc_74, loc_75,
  loc_b0, loc_b1, loc_111, loc_31a, loc_32a, loc_33a, loc_34a,
} from "./names.js";
import { loc_c772 } from "./loc_c772.js";
import { loc_c423 } from "./loc_c423.js";

// Skip when the gate byte is set; otherwise seat the four record fields from indexed
// tables, emit the header, cache its cursor, then draw one record per pass, bumping the
// index by 0x10 whenever the low nibble saturates.
export function loc_c36e(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  if (a !== 0) return;

  mem8[loc_37] = y;
  mem8[loc_61] = mem8[u16(loc_32a + y)];
  mem8[loc_62] = mem8[u16(loc_31a + y)];
  mem8[loc_63] = mem8[u16(loc_34a + y)];
  mem8[loc_64] = mem8[u16(loc_33a + y)];

  loc_c772(m, 0x61);
  mem8[loc_b0] = mem8[loc_74];
  mem8[loc_b1] = mem8[loc_75];

  const count = mem8[loc_111] !== 0 ? 0x0e : 0x0f;
  mem8[loc_73] = 0xc0;
  mem8[loc_38] = count;

  do {
    let t = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = t;
    if ((t & 0x0f) === 0x0f) mem8[loc_37] = t + 0x10;
    loc_c423(m);
    mem8[loc_38] = mem8[loc_38] - 1;
  } while ((mem8[loc_38] & 0x80) === 0);
}
