// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_2b, loc_3d, loc_5, loc_cdde, loc_2f60, loc_cde0, loc_48, loc_38,
  loc_3284, loc_3286, loc_00, loc_cde2, loc_a97d, loc_3b, loc_3c,
} from "./names.js";
import { loc_a9d7 } from "./loc_a9d7.js";

// Build a 7-entry vector list from base indices keyed by y, seed the
// glyph pointer, then hand off to the nibble emitter.
export function loc_a97f(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y;

  // Head value: zeroed only when y hits the marker and $05's top bit is set.
  if (y === mem8[loc_3d] && (mem8[loc_5] & 0x80) !== 0) a = 0x00;
  a |= 0x70;

  let x = mem8[u16(loc_cdde + y)];
  mem8[u16(loc_2f60 + x)] = a;
  x = mem8[u16(loc_cde0 + y)];

  // Row count from the count cell; one short when at the marker index.
  let count = mem8[u16(loc_48 + y)];
  mem8[loc_38] = count;
  if (count !== 0 && y === mem8[loc_3d]) mem8[loc_38] = u8(mem8[loc_38] - 1);

  for (let row = 1; ; ) {
    // Rows past the count use the alternate glyph.
    const glyph = row > mem8[loc_38] ? mem8[loc_3286] : mem8[loc_3284];
    mem8[u16(loc_2f60 + x)] = glyph;
    x = u8(x + 2);
    row = u8(row + 1);
    if (row >= 7) break;
  }

  const yr = mem8[loc_2b];
  // Early out on state 4 away from the marker: no glyph pointer, no emit.
  if (mem8[loc_00] === 4 && yr !== mem8[loc_3d]) return;

  x = mem8[u16(loc_cde2 + yr)];
  mem8[loc_3b] = mem8[u16(loc_a97d + yr)];
  mem8[loc_3c] = 0x00;
  return loc_a9d7(m, x);
}
