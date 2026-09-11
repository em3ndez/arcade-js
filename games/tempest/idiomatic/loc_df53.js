// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Write the fixed {0x40,0x80} header pair at the cursor, then step the cursor past it.
export function loc_df53(m) {
  const { mem8, mem16 } = m;
  const ptr = mem16[loc_74];
  mem8[ptr] = 0x40;
  mem8[u16(ptr + 1)] = 0x80;
  loc_df5f(m, 1);
}
