// SPDX-License-Identifier: GPL-3.0-only
import { loc_72 } from "./names.js";
import { loc_df6a } from "./loc_df6a.js";

// Skip when the byte already matches; otherwise latch it and emit its vector word.
export function loc_b0dd(m, a = m.regs.a) {
  const { mem8 } = m;
  if (a === mem8[loc_72]) return;
  mem8[loc_72] = a;
  return loc_df6a(m, a);
}
