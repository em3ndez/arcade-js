// SPDX-License-Identifier: GPL-3.0-only
import { loc_147, loc_148, loc_10c } from "./names.js";

// Combine the two source bytes ((first << 2) + second) & second, keep bit 7,
// invert it, and store the result: zero when that high bit is set, 0x80 when
// clear. All arithmetic wraps to a byte.
export function loc_9c3b(m) {
  const { mem8 } = m;
  let a = (mem8[loc_147] << 2) & 0xff;
  a = (a + mem8[loc_148]) & 0xff;
  a = (a & mem8[loc_148] & 0x80) ^ 0x80;
  mem8[loc_10c] = a;
}
