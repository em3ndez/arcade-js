// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2b, loc_29, loc_2c } from "./names.js";

// Record the cursor index, then return the base value minus the pointed table byte two slots back.
export function loc_96f4(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const base = mem8[loc_2b];
  mem8[loc_29] = y;
  const operand = mem8[u16(mem16[loc_2c] + ((y - 2) & 0xff))];
  return (base - operand) & 0xff;
}
