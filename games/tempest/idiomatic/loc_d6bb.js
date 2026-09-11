// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_dbe0 } from "./loc_dbe0.js";
import {
  loc_a, loc_9, loc_ac, loc_ad, loc_156, loc_158, loc_16a,
  loc_d00, loc_e00, loc_d6b3, loc_d6b4, loc_d6f7, loc_d6ff,
} from "./names.js";

// Slice one input byte into three table lookups plus a toggled copy of a second
// byte, then fold the final pair through the merge and record its result.
export function loc_d6bb(m) {
  const { mem8 } = m;
  const a0 = mem8[loc_e00];
  mem8[loc_a] = a0;
  mem8[loc_156] = mem8[u16(loc_d6f7 + ((a0 >> 3) & 0x07))];
  mem8[loc_9] = mem8[loc_d00] ^ 0x02;
  mem8[loc_158] = mem8[u16(loc_d6ff + ((a0 >> 6) & 0x03))];
  const y = a0 & 0x06;
  mem8[loc_ac] = mem8[u16(loc_d6b3 + y)];
  const ad = mem8[u16(loc_d6b4 + y)];
  mem8[loc_ad] = ad;
  mem8[loc_16a] = loc_dbe0(m, ad);
}
