// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_61 } from "./names.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// Advance the slot index, publish it through the pointer byte, then emit that
// one-byte run.
export function loc_aa9e(m, x = m.regs.x) {
  const { mem8 } = m;
  x = u8(x + 1);
  mem8[loc_61] = x;
  return loc_dfb1(m, 0x61, 0x01);
}
