// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_0, loc_5, loc_3e, loc_46, loc_126 } from "./names.js";

// Find the largest byte in a zero-page window whose length is set by a cursor,
// store it decremented once when nonzero, then set one cell to 0x14 or (when a
// status byte is negative) 0x10.
export function loc_c9f1(m) {
  const { mem8 } = m;
  let max = 0;
  let x = mem8[loc_3e];
  for (;;) {
    const v = mem8[u8(loc_46 + x)];
    if (v >= max) max = v;
    if (x === 0) break;
    x = u8(x - 1);
  }
  mem8[loc_126] = max === 0 ? 0 : (max - 1) & 0xff;
  mem8[loc_0] = (mem8[loc_5] & 0x80) ? 0x10 : 0x14;
}
