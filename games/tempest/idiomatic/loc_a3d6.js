// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, loc_2c, loc_2d, loc_35, loc_36, loc_116, loc_2fa, loc_302, loc_30a, loc_312 } from "./names.js";

// Insert a new object into the 8-slot table: reuse the first empty slot found,
// or when none is free evict the slot holding the largest counter (and drop the
// live count by one). Fill the chosen slot's four parallel fields, bump the count.
export function loc_a3d6(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_35] = x;
  mem8[loc_36] = y;
  mem8[loc_2a] = 0;
  mem8[loc_2b] = 0;
  let slot = -1;
  for (let i = 7; i >= 0; i--) {
    if (mem8[u16(loc_30a + i)] === 0) { slot = i; break; }
    const age = mem8[u16(loc_312 + i)];
    if (age >= mem8[loc_2a]) {
      mem8[loc_2a] = age;
      mem8[loc_2b] = i;
    }
  }
  if (slot < 0) {
    mem8[loc_116] = u8(mem8[loc_116] - 1);
    slot = mem8[loc_2b];
  }
  mem8[u16(loc_312 + slot)] = 0;
  mem8[u16(loc_302 + slot)] = mem8[loc_2c];
  mem8[u16(loc_30a + slot)] = mem8[loc_29];
  mem8[u16(loc_2fa + slot)] = mem8[loc_2d];
  mem8[loc_116] = u8(mem8[loc_116] + 1);
}
