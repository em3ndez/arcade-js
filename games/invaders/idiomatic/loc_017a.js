// SPDX-License-Identifier: GPL-3.0-only
import { loc_2009, loc_200a } from "./names.js";

// Split L over 0x0b: step B by 0x10 per whole part, C by 0x10 per remainder. Live-out: L, C, D.
export function loc_017a(m, l = m.regs.l) {
  let b = m.mem8[loc_2009];
  let c = m.mem8[loc_200a];
  let d = 0;
  let a = l;
  while (((a - 0x0b) & 0x80) === 0) { a = (a - 0x0b) & 0xff; b = (b + 0x10) & 0xff; d = (d + 1) & 0xff; }
  while (a !== 0) { c = (c + 0x10) & 0xff; a = (a - 1) & 0xff; }
  return [m.regs.l = b, m.regs.c = c, m.regs.d = d];
}
