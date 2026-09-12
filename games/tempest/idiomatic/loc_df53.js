// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Emit a two-byte vector word at the cursor origin -- first byte a, second byte x --
// then step the cursor past it. The shared tail reached with the pair preset.
export function loc_df57(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const ptr = mem16[loc_74];
  mem8[ptr] = a;
  mem8[u16(ptr + 1)] = x;
  loc_df5f(m, 1);
}

// Write the fixed {0x40,0x80} header pair at the cursor, then step the cursor past it.
export function loc_df53(m) {
  return loc_df57(m, 0x40, 0x80);
}
