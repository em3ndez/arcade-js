// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, POINTER_PARITY, DRAW_PTR_TABLE_A, DRAW_PTR_TABLE_B } from "./names.js";

// Pick a 16-bit pointer from one of two tables (selected by a per-index flag) at
// stride 2*index, publish it into the indirect pointer slot, then clear the status cell.
export function seatDrawCursor(m, a = m.regs.a) {
  const { mem8 } = m;
  const idx = a;
  const off = (a << 1) & 0xff;                               // two-byte table stride
  // Nonzero flag selects the first table; zero selects the second.
  const table = mem8[u16(POINTER_PARITY + idx)] !== 0 ? DRAW_PTR_TABLE_A : DRAW_PTR_TABLE_B;
  mem8[DRAW_CURSOR_LO] = mem8[u16(table + off)];                     // pointer low byte
  mem8[DRAW_CURSOR_HI] = mem8[u16(table + 1 + off)];                 // pointer high byte
  mem8[DRAW_CURSOR_OFFSET] = 0;                                          // clear the status cell
}
