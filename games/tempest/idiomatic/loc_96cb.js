// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2c, loc_2d } from "./names.js";

// Walk a packed coordinate list through the zero-page pointer: read the entry at the
// cursor and its predecessor, store their difference as the step delta, then advance the
// cursor by that delta plus two.
export function loc_96cb(m, y = m.regs.y) {
  const { mem8 } = m;
  const ptr = mem8[loc_2c] | (mem8[loc_2d] << 8);
  const cur = mem8[u16(ptr + y)];
  const yDec = u8(y - 1);
  const prev = mem8[u16(ptr + yDec)];
  const delta = u8(cur - prev);
  mem8[loc_29] = delta;
  const aOut = u8(yDec + delta + 1);
  const yOut = u8(aOut + 2);
  return [(m.regs.a = aOut), (m.regs.y = yOut)];
}
