// SPDX-License-Identifier: GPL-3.0-only
import { loc_73 } from "./names.js";
import { loc_df4c } from "./loc_df4c.js";

// Emit a vector word tagged with the $60 header, using the low table byte as its data.
export function loc_df4a(m, a = m.regs.a) {
  const { mem8 } = m;
  return loc_df4c(m, a, mem8[loc_73]);
}
