// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2df } from "./names.js";
import { loc_ccc1 } from "./loc_ccc1.js";
import { loc_a3d4 } from "./loc_a3d4.js";

// Ring the fixed sound cue, copy the y-indexed table byte into the scratch field,
// then insert a fresh object into the slot table.
export function loc_a3ca(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  loc_ccc1(m, x, y);
  mem8[loc_29] = mem8[u16(loc_2df + y)];
  return loc_a3d4(m, a, x, y);
}
