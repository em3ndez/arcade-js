// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_200, loc_201, loc_2ad } from "./names.js";
import { loc_a34b } from "./loc_a34b.js";

// Prime the top object only when the live byte matches slot x's target and the
// ready flag is not already set high; then latch the flag.
export function loc_a1e4(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[loc_200] !== mem8[u16(loc_2ad + x)]) return;
  if (mem8[loc_201] & 0x80) return;
  loc_a34b(m, x, y);
  mem8[loc_201] = 0x81;
}
