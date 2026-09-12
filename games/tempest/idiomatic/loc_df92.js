// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0, loc_1, loc_2, loc_3, loc_73, loc_74 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// Emit a 4-byte record through the cursor pointer: x, packed y, x again, then a
// key-folded 5-bit last byte, from four zeropage slots based off the index.
export function loc_df92(m, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const base = mem16[loc_74];
  mem8[u16(base + 0)] = mem8[(loc_2 + x) & 0xff];
  mem8[u16(base + 1)] = mem8[(loc_3 + x) & 0xff] & 0x1f;
  mem8[u16(base + 2)] = mem8[(loc_0 + x) & 0xff];
  const key = mem8[loc_73];
  const last = ((mem8[(loc_1 + x) & 0xff] ^ key) & 0x1f) ^ key;
  return loc_dfac(m, last, 2);
}

// Store one more byte at the next cursor slot; advance the cursor unless the
// slot index wrapped to zero, in which case run the terminating byte run.
export function loc_dfac(m, a = m.regs.a, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const yy = (y + 1) & 0xff;
  mem8[u16(mem16[loc_74] + yy)] = a;
  if (yy !== 0) return loc_df5f(m, yy);
  return loc_dfb1(m, a, yy);
}
