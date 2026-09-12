// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_55, loc_74, loc_78, loc_a9, loc_cec8, loc_cec9 } from "./names.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c765 } from "./loc_c765.js";
import { loc_bd3e } from "./loc_bd3e.js";
import { loc_df59 } from "./loc_df59.js";

// Fold the live deltas, lay the fixed header, then append the (mantissa, exponent) pair: the
// appender returns its exit cursor, threaded into the two vector-list stores below. Clamp the
// colour/intensity nibble, emit two bytes at the cursor, then reload the entry template from a
// word table and tail into the emitter.
export function loc_bd09(m) {
  const { mem8, mem16 } = m;
  loc_c098(m);
  loc_c765(m, 0x61);
  mem8[loc_a9] = 0x00;
  const yExit = loc_bd3e(m); // appended pair returns its exit cursor

  // Clamp the color/intensity nibble, then shift it into the high nibble of the first byte.
  let a = mem8[loc_78] ^ 0x07;
  a = (a << 1) & 0xff;
  if (a < 0x0a) a = 0x0a;
  a = (a << 4) & 0xff;

  const ptr = mem16[loc_74];
  let y = yExit;
  mem8[u16(ptr + y)] = a;
  y = (y + 1) & 0xff;
  mem8[u16(ptr + y)] = 0x60;
  y = (y + 1) & 0xff;
  mem8[loc_a9] = y; // record the advanced cursor length

  // Reload the template, restore the cursor, tail out.
  y = mem8[loc_55];
  const x = mem8[u16(loc_cec9 + y)];
  a = mem8[u16(loc_cec8 + y)];
  y = mem8[loc_a9];
  return loc_df59(m, a, x, y);
}
