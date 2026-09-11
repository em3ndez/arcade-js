// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2b, loc_2c } from "./names.js";

// Coordinate helper over a vector list through the zero-page pointer: stash the incoming
// cursor, combine a counter-derived (or raw) value with the delta two entries back, then
// re-index by the result and load the entry it points to.
export function loc_96ab(m, y = m.regs.y) {
  const { mem8 } = m;
  return body(m, ((mem8[loc_2b] - 1) & 0x0f) + 1, y);
}

export function loc_96b7(m, y = m.regs.y) {
  const { mem8 } = m;
  return body(m, mem8[loc_2b], y);
}

function body(m, a, y) {
  const { mem8, mem16 } = m;
  mem8[loc_29] = y;
  const ptr = mem16[loc_2c];
  a = u8(a - mem8[u16(ptr + u8(y - 2))]);
  a = u8(a + mem8[loc_29]);
  return [(m.regs.a = mem8[u16(ptr + a)]), (m.regs.y = a)];
}

export function loc_96c4(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  return (m.regs.a = mem8[u16(mem16[loc_2c] + y)]);
}
