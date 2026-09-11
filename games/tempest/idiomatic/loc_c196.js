// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_19, loc_21, loc_9f, loc_800, loc_808, loc_c1fd } from "./names.js";

// From a level index, split eight packed table bytes into low/high nibbles, mirroring each into
// zero-page and color RAM.
export function loc_c196(m) {
  const { mem8 } = m;
  let sel = mem8[loc_9f] & 0x70;
  if (sel >= 0x5f) sel = 0x5f;
  let x = (sel >> 1) | 0x07;
  for (let y = 7; y >= 0; y--) {
    const b = mem8[u16(loc_c1fd + x)];
    const lo = b & 0x0f;
    mem8[u16(loc_19 + y)] = lo;
    mem8[u16(loc_800 + y)] = lo;
    const hi = b >> 4;
    mem8[u16(loc_21 + y)] = hi;
    mem8[u16(loc_808 + y)] = hi;
    x--;
  }
}
