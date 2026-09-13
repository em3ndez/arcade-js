// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

// Store 0, 0, 0, A into the four bytes at the working pointer, then advance that pointer by four.
export function loc_b56a(m, a = m.regs.a) {
  const { mem8 } = m;
  const ptr = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
  mem8[u16(ptr)] = 0;
  mem8[u16(ptr + 1)] = 0;
  mem8[u16(ptr + 2)] = 0;
  mem8[u16(ptr + 3)] = a;
  const sum = mem8[DRAW_CURSOR_LO] + 4;                 // advance the low byte, carrying into the high byte
  mem8[DRAW_CURSOR_LO] = sum;
  if (sum > 0xff) mem8[DRAW_CURSOR_HI] = (mem8[DRAW_CURSOR_HI] + 1);
}
