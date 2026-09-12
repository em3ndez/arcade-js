// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_73, loc_74 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_df4c } from "./loc_df4c.js";

// Emit a coordinate word through the cursor: the high byte is the tagged upper nibble
// of the first input, the low byte the second input rotated right, then advance.
export function loc_df39(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const carry = a & 0x01;
  const hi = ((a >> 1) & 0x0f) | 0xa0;
  const lo = ((carry << 7) | (x >> 1)) & 0xff;
  const ptr = mem16[loc_74];
  let y = 0x01;
  mem8[u16(ptr + y)] = hi;
  y = (y - 1) & 0xff;
  mem8[u16(ptr + y)] = lo;
  y = (y + 1) & 0xff;
  if (y !== 0) return loc_df5f(m, y);
  return loc_df4c(m, lo, mem8[loc_73]);
}
