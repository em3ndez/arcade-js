// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { LEVEL_GEOM_LO, LEVEL_GEOM_HI, loc_9f, COLOR_RAM, COLOR_RAM_8, LEVEL_LAYOUT_PACKED } from "./names.js";

// From a level index, split eight packed table bytes into low/high nibbles, mirroring each into
// zero-page and color RAM.
export function loc_c196(m) {
  const { mem8 } = m;
  let sel = mem8[loc_9f] & 0x70;
  if (sel >= 0x5f) sel = 0x5f;
  let x = (sel >> 1) | 0x07;
  for (let y = 7; y >= 0; y--) {
    const b = mem8[u16(LEVEL_LAYOUT_PACKED + x)];
    const lo = b & 0x0f;
    mem8[u16(LEVEL_GEOM_LO + y)] = lo;
    mem8[u16(COLOR_RAM + y)] = lo;
    const hi = b >> 4;
    mem8[u16(LEVEL_GEOM_HI + y)] = hi;
    mem8[u16(COLOR_RAM_8 + y)] = hi;
    x--;
  }
}
