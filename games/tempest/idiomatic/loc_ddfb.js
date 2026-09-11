// SPDX-License-Identifier: GPL-3.0-only
import { loc_1c6, loc_1c7, loc_1c8 } from "./names.js";

// Store Y into the first flag byte and OR mask A into the next two. The two
// alt-entries preset that pair: one supplies mask 4 with a zeroed index, the
// other only zeroes the index before the shared tail runs.
export function loc_ddfb(m) {
  return loc_ddfd(m, 0x04);
}

export function loc_ddfd(m, a = m.regs.a) {
  return loc_ddff(m, a, 0x00);
}

export function loc_ddff(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_1c6] = y;
  mem8[loc_1c7] = (mem8[loc_1c7] | a);
  mem8[loc_1c8] = (mem8[loc_1c8] | a);
}
