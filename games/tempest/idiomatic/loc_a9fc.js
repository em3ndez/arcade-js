// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2f60, loc_31e4 } from "./names.js";

// Map a nibble to a table byte and store it at the cursor, advancing the cursor by two.
export function loc_a9fc(m, a = m.regs.a, x = m.regs.x, carryIn = m.regs.fC) {
  const { mem8 } = m;
  const nibble = a & 0x0f;
  // A zero nibble with carry set indexes entry 0; otherwise step one past the nibble.
  const y = nibble === 0 && carryIn ? 0 : nibble + 1;
  mem8[u16(loc_2f60 + x)] = mem8[u16(loc_31e4 + ((y << 1) & 0xff))];
  return (m.regs.x = u8(x + 2));
}
