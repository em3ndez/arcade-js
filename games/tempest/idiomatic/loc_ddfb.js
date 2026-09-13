// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";

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
  mem8[EAROM_BLANK_FLAG] = y;
  mem8[EAROM_REGION_PENDING] = (mem8[EAROM_REGION_PENDING] | a);
  mem8[EAROM_REGION_DIR] = (mem8[EAROM_REGION_DIR] | a);
}
