// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, loc_91c6, loc_91c7 } from "./names.js";

// Double the selector into a word index, clear the paired flag byte, and copy the
// selected little-endian pointer from the in-page table into the working pointer slot.
export function loc_91b5(m, a = m.regs.a) {
  const { mem8 } = m;
  const index = u8(a << 1);
  mem8[loc_29] = 0;
  mem8[loc_2a] = mem8[u16(loc_91c6 + index)];
  mem8[loc_2b] = mem8[u16(loc_91c7 + index)];
}
