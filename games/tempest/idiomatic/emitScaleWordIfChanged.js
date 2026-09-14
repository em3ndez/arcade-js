// SPDX-License-Identifier: GPL-3.0-only
import { VG_LAST_STAT } from "./names.js";
import { loc_df6a } from "./loc_df6a.js";

// Skip when the byte already matches; otherwise latch it and emit its vector word.
export function emitScaleWordIfChanged(m, a = m.regs.a) {
  const { mem8 } = m;
  if (a === mem8[VG_LAST_STAT]) return;
  mem8[VG_LAST_STAT] = a;
  return loc_df6a(m, a);
}
