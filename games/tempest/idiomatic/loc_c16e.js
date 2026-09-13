// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  PROJ_Y_REF, REDRAW_COUNTER, LEVEL_LAYOUT_TRIGGER, AVG_RESET_STROBE, VEC_LIST_HEADER_LO, VEC_LIST_HEADER_HI, VECHEAD0_LEVEL, VECHEAD1_LEVEL,
  loc_9f, LEVEL_LAYOUT_PACKED, LEVEL_GEOM_LO, LEVEL_GEOM_HI, COLOR_RAM, COLOR_RAM_8,
} from "./names.js";
import { loc_aa13 } from "./loc_aa13.js";
import { loc_c235 } from "./loc_c235.js";

// Prime the working flags, build the level layout, mirror two header bytes into the
// display list, then unpack a clamped table entry into the four per-column arrays.
export function loc_c16e(m) {
  const { mem8 } = m;
  loc_aa13(m);
  mem8[PROJ_Y_REF] = 0x80;
  mem8[REDRAW_COUNTER] = 0xff;
  loc_c235(m);
  // Reset the mode flag, kicking the trigger byte only when it was already clear.
  if (mem8[LEVEL_LAYOUT_TRIGGER] === 0) mem8[AVG_RESET_STROBE] = 0x00;
  mem8[LEVEL_LAYOUT_TRIGGER] = 0x00;
  mem8[VEC_LIST_HEADER_LO] = mem8[VECHEAD0_LEVEL];
  mem8[VEC_LIST_HEADER_HI] = mem8[VECHEAD1_LEVEL];

  // Clamp the selector, halve it, force the low bits, then walk eight entries down.
  let idx = mem8[loc_9f] & 0x70;
  if (idx >= 0x5f) idx = 0x5f;
  idx = (idx >> 1) | 0x07;
  for (let y = 7; y >= 0; y--) {
    const packed = mem8[u16(LEVEL_LAYOUT_PACKED + idx)];
    const lo = packed & 0x0f;
    mem8[u16(LEVEL_GEOM_LO + y)] = lo;
    mem8[u16(COLOR_RAM + y)] = lo;
    const hi = packed >> 4;
    mem8[u16(LEVEL_GEOM_HI + y)] = hi;
    mem8[u16(COLOR_RAM_8 + y)] = hi;
    idx = u8(idx - 1);
  }
}
