// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60c1, loc_60d1 } from "./names.js";
import { loc_df39 } from "./loc_df39.js";

// Emit the header word for the incoming pair, then blank two output tables at their
// four even slots.
export function loc_db88(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  loc_df39(m, a, x);
  for (let i = 6; i >= 0; i -= 2) {
    mem8[u16(loc_60c1 + i)] = 0x00;
    mem8[u16(loc_60d1 + i)] = 0x00;
  }
}
