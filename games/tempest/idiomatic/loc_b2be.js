// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74, loc_75, loc_a9, loc_415, loc_ce68, loc_ce7a } from "./names.js";

// Pick a 16-bit pointer from one of two tables (selected by a per-index flag) at
// stride 2*index, publish it into the indirect pointer slot, then clear the status cell.
export function loc_b2be(m, a = m.regs.a) {
  const { mem8 } = m;
  const idx = a;
  const off = (a << 1) & 0xff;                               // two-byte table stride
  // Nonzero flag selects the first table; zero selects the second.
  const table = mem8[u16(loc_415 + idx)] !== 0 ? loc_ce68 : loc_ce7a;
  mem8[loc_74] = mem8[u16(table + off)];                     // pointer low byte
  mem8[loc_75] = mem8[u16(table + 1 + off)];                 // pointer high byte
  mem8[loc_a9] = 0;                                          // clear the status cell
}
