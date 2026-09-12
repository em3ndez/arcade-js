// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_55, loc_56, loc_58, loc_435, loc_445 } from "./names.js";
import { loc_bd09 } from "./loc_bd09.js";

// Stash the value byte, load two indexed table entries into the work cells, then emit.
export function loc_bcfd(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_55] = a;
  mem8[loc_56] = mem8[u16(loc_435 + y)];
  mem8[loc_58] = mem8[u16(loc_445 + y)];
  return loc_bd09(m);
}
