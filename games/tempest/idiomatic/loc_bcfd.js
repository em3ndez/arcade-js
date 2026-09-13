// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_STYLE, PROJ_PT_Y, PROJ_PT_X, SEG_MID_X, SEG_MID_Y } from "./names.js";
import { loc_bd09 } from "./loc_bd09.js";

// Stash the value byte, load two indexed table entries into the work cells, then emit.
export function loc_bcfd(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[DRAW_STYLE] = a;
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + y)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + y)];
  return loc_bd09(m);
}
