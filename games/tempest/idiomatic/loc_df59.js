// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Store the pair {a, x} at the cursor offset y and y+1, then step the cursor past them.
export function loc_df59(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const ptr = mem16[loc_74];
  const next = (y + 1) & 0xff;
  mem8[u16(ptr + y)] = a;
  mem8[u16(ptr + next)] = x;
  loc_df5f(m, next);
}
