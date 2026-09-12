// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_5e, loc_114, loc_133, loc_5800, loc_2000, loc_2001, loc_cec6, loc_cec7,
  loc_9f, loc_c1fd, loc_19, loc_21, loc_800, loc_808,
} from "./names.js";
import { loc_aa13 } from "./loc_aa13.js";
import { loc_c235 } from "./loc_c235.js";

// Prime the working flags, build the level layout, mirror two header bytes into the
// display list, then unpack a clamped table entry into the four per-column arrays.
export function loc_c16e(m) {
  const { mem8 } = m;
  loc_aa13(m);
  mem8[loc_5e] = 0x80;
  mem8[loc_114] = 0xff;
  loc_c235(m);
  // Reset the mode flag, kicking the trigger byte only when it was already clear.
  if (mem8[loc_133] === 0) mem8[loc_5800] = 0x00;
  mem8[loc_133] = 0x00;
  mem8[loc_2000] = mem8[loc_cec6];
  mem8[loc_2001] = mem8[loc_cec7];

  // Clamp the selector, halve it, force the low bits, then walk eight entries down.
  let idx = mem8[loc_9f] & 0x70;
  if (idx >= 0x5f) idx = 0x5f;
  idx = (idx >> 1) | 0x07;
  for (let y = 7; y >= 0; y--) {
    const packed = mem8[u16(loc_c1fd + idx)];
    const lo = packed & 0x0f;
    mem8[u16(loc_19 + y)] = lo;
    mem8[u16(loc_800 + y)] = lo;
    const hi = packed >> 4;
    mem8[u16(loc_21 + y)] = hi;
    mem8[u16(loc_808 + y)] = hi;
    idx = u8(idx - 1);
  }
}
