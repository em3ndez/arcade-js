// SPDX-License-Identifier: GPL-3.0-only
import { VEC_DELTA_Y_LO, DRAW_DELTA_A_HI, DRAW_DELTA_B_LO, DRAW_DELTA_B_HI } from "./names.js";
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
  [mem8[VEC_DELTA_Y_LO], mem8[DRAW_DELTA_A_HI]] = scale4(a);
  [mem8[DRAW_DELTA_B_LO], mem8[DRAW_DELTA_B_HI]] = scale4(x);
  return loc_df92(m, VEC_DELTA_Y_LO);
}
