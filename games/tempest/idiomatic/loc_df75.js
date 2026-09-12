// SPDX-License-Identifier: GPL-3.0-only
import { loc_6e, loc_6f, loc_70, loc_71 } from "./names.js";
import { loc_df92 } from "./loc_df92.js";

// Widen two input values by four with sign extension into adjacent little-endian
// pairs, then emit the vector record they anchor.
function scale4(v) {
  const signHi = v & 0x80 ? 0xff : 0x00;
  const low = (v << 2) & 0xff;
  const high = ((signHi << 1) | ((v >> 6) & 1)) & 0xff;
  return [low, high];
}

export function loc_df75(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  [mem8[loc_6e], mem8[loc_6f]] = scale4(a);
  [mem8[loc_70], mem8[loc_71]] = scale4(x);
  return loc_df92(m, loc_6e);
}
