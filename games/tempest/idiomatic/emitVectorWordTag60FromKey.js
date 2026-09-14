// SPDX-License-Identifier: GPL-3.0-only
import { VG_RECORD_HEADER } from "./names.js";
import { loc_df4c } from "./loc_df4c.js";

// Emit a vector word tagged with the $60 header, using the low table byte as its data.
export function emitVectorWordTag60FromKey(m, a = m.regs.a) {
  const { mem8 } = m;
  return loc_df4c(m, a, mem8[VG_RECORD_HEADER]);
}
