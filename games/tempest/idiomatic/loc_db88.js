// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { POKEY1_AUDC1, POKEY2_AUDC1 } from "./names.js";
import { loc_df39 } from "./loc_df39.js";

// Emit the header word for the incoming pair, then blank two output tables at their
// four even slots.
export function loc_db88(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  loc_df39(m, a, x);
  for (let i = 6; i >= 0; i -= 2) {
    mem8[u16(POKEY1_AUDC1 + i)] = 0x00;
    mem8[u16(POKEY2_AUDC1 + i)] = 0x00;
  }
}
