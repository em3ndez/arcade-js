// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_36, loc_11c, loc_2df, loc_29, loc_2a, loc_111, loc_60ca,
  loc_2b9, loc_2cc, loc_2a6, loc_2c, loc_28a, loc_2d, loc_291,
  loc_108, loc_2b, loc_283, loc_142,
} from "./names.js";

// Find a free slot in the active table by scanning a count index down to zero;
// on a hit, seed the slot's parallel per-entry arrays, bump the active count and
// a per-lane counter, and report 0x10. Report 0 when no slot is free.
export function loc_994d(m, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_36] = y;
  y = mem8[loc_11c];
  while (mem8[u16(loc_2df + y)] !== 0) {
    y = u8(y - 1);
    if (y & 0x80) return (m.regs.a = 0x00); // scanned past index 0
  }
  mem8[u16(loc_2df + y)] = mem8[loc_29];
  let a = mem8[loc_2a];
  if (a === 0x0f && mem8[loc_111] & 0x80) a = mem8[loc_60ca] & 0x0e;
  mem8[u16(loc_2b9 + y)] = a;
  mem8[u16(loc_2cc + y)] = (a + 1) & 0x0f;
  mem8[u16(loc_2a6 + y)] = 0x00;
  mem8[u16(loc_28a + y)] = mem8[loc_2c];
  mem8[u16(loc_291 + y)] = mem8[loc_2d];
  mem8[loc_108] = mem8[loc_108] + 1;
  mem8[u16(loc_283 + y)] = mem8[loc_2b];
  const lane = mem8[loc_2b] & 0x07;
  mem8[loc_36] = x;
  mem8[u16(loc_142 + lane)] = mem8[u16(loc_142 + lane)] + 1;
  return (m.regs.a = 0x10);
}
