// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2b9, loc_3 } from "./names.js";
import { loc_bcfd } from "./loc_bcfd.js";

// Pick slot x's table index, add a four-phase animation offset, and emit that pair.
export function loc_b622(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(loc_2b9 + x)];
  const a = (((mem8[loc_3] & 0x03) << 1) + 0x12) & 0xff;
  return loc_bcfd(m, a, y);
}
