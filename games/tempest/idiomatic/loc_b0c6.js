// SPDX-License-Identifier: GPL-3.0-only
import { loc_91b5 } from "./loc_91b5.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// Select a pointer from the table by index, then emit a three-byte zeropage run as nibbles.
export function loc_b0c6(m, x = m.regs.x) {
  loc_91b5(m, x);
  loc_dfb1(m, 0x29, 0x03);
}
