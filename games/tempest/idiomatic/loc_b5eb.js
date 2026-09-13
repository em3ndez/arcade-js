// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_9e, DRAW_STYLE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, SEG_SHAPE_BY_STYLE } from "./names.js";
import { loc_b634 } from "./loc_b634.js";
import { loc_bda0, loc_bdcb } from "./loc_bda0.js";

// Set the run count, then split on the slot's sign byte: a negative slot preps a
// coordinate and builds a segment at corner zero; otherwise build one at the slot's
// corner using a header byte picked from a small table by the shared style index.
export function loc_b5eb(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x03;
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {
    loc_b634(m, x);
    loc_bdcb(m, 0x00);
    return;
  }
  const corner = mem8[u16(ENEMY_SEGMENT + x)];
  const style = mem8[DRAW_STYLE];
  loc_bda0(m, mem8[u16(SEG_SHAPE_BY_STYLE + style)], corner);
}
