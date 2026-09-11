// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_00, loc_10b, loc_298, loc_a0f7 } from "./names.js";

// Advance the rolling counter, use it to select a table byte, treat that byte as a
// zero-page pointer, and copy the pointed-at byte into slot X's cell.
export function loc_9bdd(m, x = m.regs.x) {
  const { mem8 } = m;

  mem8[loc_10b] = mem8[loc_10b] + 1;

  const idx = mem8[loc_10b];

  // Table byte doubles as a zero-page pointer index.
  const ptr = mem8[u16(loc_a0f7 + idx)];

  const value = mem8[u16(loc_00 + ptr)];

  mem8[u16(loc_298 + x)] = value;
}
