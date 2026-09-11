// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_283 } from "./names.js";

// Toggle bit 6 of the slot's direction/flags cell in place and return the new value.
export function loc_9c4f(m, x = m.regs.x) {
  const { mem8 } = m;
  const addr = u16(loc_283 + x);
  const value = mem8[addr] ^ 0x40;
  mem8[addr] = value;
  return (m.regs.a = value);
}
