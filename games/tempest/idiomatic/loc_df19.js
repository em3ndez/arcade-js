// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74, loc_31e4 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Pick a word-table index from the low nibble (0 when carry-set and the nibble is
// zero, else nibble+1), copy that entry's two bytes into the ($74) list, then step
// the cursor past them.
export function loc_df19(m, a = m.regs.a, c = m.regs.fC) {
  const { mem8, mem16 } = m;
  const low = a & 0x0f;
  const idx = c && low === 0 ? 0 : low + 1;
  const src = u16(loc_31e4 + (idx << 1));
  const dst = mem16[loc_74];
  mem8[u16(dst)] = mem8[src];
  mem8[u16(dst + 1)] = mem8[u16(src + 1)];
  loc_df5f(m, 1);
}
