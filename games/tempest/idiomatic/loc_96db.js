// SPDX-License-Identifier: GPL-3.0-only
import { COORD_LIST_PTR_LO, ENEMY_CLIMB_DELTA_LO_0 } from "./names.js";
import { u16 } from "../../../core/int.js";

// Resolve a list entry to an absolute coordinate: read the byte at the pointer indexed by
// the entry offset, then add the base value. Returns the sum in A.
export function loc_96db(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const ptr = mem16[COORD_LIST_PTR_LO];
  const value = mem8[u16(ptr + y)];
  return (m.regs.a = (value + mem8[ENEMY_CLIMB_DELTA_LO_0]) & 0xff);
}
