// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74, loc_75 } from "./names.js";

// Store 0, 0, 0, A into the four bytes at the working pointer, then advance that pointer by four.
export function loc_b56a(m, a = m.regs.a) {
  const { mem8 } = m;
  const ptr = mem8[loc_74] | (mem8[loc_75] << 8);
  mem8[u16(ptr)] = 0;
  mem8[u16(ptr + 1)] = 0;
  mem8[u16(ptr + 2)] = 0;
  mem8[u16(ptr + 3)] = a;
  const sum = mem8[loc_74] + 4;                 // advance the low byte, carrying into the high byte
  mem8[loc_74] = sum;
  if (sum > 0xff) mem8[loc_75] = (mem8[loc_75] + 1);
}
