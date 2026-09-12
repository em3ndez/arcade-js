// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_3b, loc_3c, loc_415,
  loc_ce8c, loc_ce8d, loc_ce9e, loc_ce9f, loc_ceb0, loc_ceb1,
} from "./names.js";
import { loc_df09 } from "./loc_df09.js";

// Emit one header record, toggle this slot's parity flag, then write the pointer target
// with the word chosen by the freshly toggled parity.
export function loc_b2fe(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  loc_df09(m);
  const slot = a;
  const idx = (a << 1) & 0xff;
  mem8[loc_3b] = mem8[u16(loc_ce8c + idx)];
  mem8[loc_3c] = mem8[u16(loc_ce8d + idx)];
  const parity = mem8[u16(loc_415 + slot)] ^ 0x01;
  mem8[u16(loc_415 + slot)] = parity;
  let lo, hi;
  if (parity !== 0) {
    lo = mem8[u16(loc_ceb0 + idx)];
    hi = mem8[u16(loc_ceb1 + idx)];
  } else {
    lo = mem8[u16(loc_ce9e + idx)];
    hi = mem8[u16(loc_ce9f + idx)];
  }
  const dst = mem16[loc_3b];
  mem8[u16(dst)] = lo;
  mem8[u16(dst + 1)] = hi;
}
