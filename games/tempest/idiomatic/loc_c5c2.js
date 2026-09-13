// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, DEPTH_LO, DEPTH_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI,
  DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, DRAW_SRC_PTR_LO, DRAW_SRC_PTR_HI, loc_110, TUBE_GEOM_FLAG, REDRAW_COUNTER,
  LANE_TARGET_FLAG, ENEMY_LIST_HEADER,
} from "./names.js";
import { loc_c66d } from "./loc_c66d.js";
import { loc_c6c7 } from "./loc_c6c7.js";
import { loc_df5f } from "./loc_df5f.js";
import { loc_df6a } from "./loc_df6a.js";

// Rebuild the per-frame enemy display list: for each active slot copy a fixed header, then
// append either a computed midpoint pair or a straight/sign-fixed coordinate block.
export function loc_c5c2(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_110] !== 0) return;
  if (mem8[DEPTH_LO] === 0 && mem8[DEPTH_HI] >= 0xf0) return;

  loc_df6a(m, 0x01);

  const savedLo = mem8[DRAW_CURSOR_LO];
  const savedHi = mem8[DRAW_CURSOR_HI];
  mem8[TABLE_CURSOR] = 0x00;
  mem8[DRAW_CURSOR_OFFSET] = 0x00;

  let slot = 0x0f;
  if (mem8[TUBE_GEOM_FLAG] !== 0) slot = (slot - 1) & 0xff;
  mem8[SLOT_LOOP_INDEX] = slot;

  for (;;) {
    const dest = mem16[DRAW_CURSOR_LO];
    let cursor = mem8[DRAW_CURSOR_OFFSET];
    for (let h = 3; h >= 0; h--) {
      mem8[u16(dest + cursor)] = mem8[u16(ENEMY_LIST_HEADER + h)];
      cursor = u8(cursor + 1);
    }
    mem8[DRAW_CURSOR_OFFSET] = cursor;

    if (mem8[REDRAW_COUNTER] !== 0) {
      loc_c66d(m);
      loc_c6c7(m);
    } else {
      const kind = mem8[u16(LANE_TARGET_FLAG + mem8[TABLE_CURSOR])];
      const src = mem16[DRAW_SRC_PTR_LO];
      let y = mem8[DRAW_CURSOR_OFFSET];
      if (kind & 0x80) {
        const b0 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b0; mem8[PREV_X_LO] = b0; y = u8(y + 1);
        const b1 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b1; mem8[PREV_X_HI] = b1 >= 0x10 ? b1 | 0xe0 : b1; y = u8(y + 1);
        const b2 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b2; mem8[PREV_Y_LO] = b2; y = u8(y + 1);
        const b3 = mem8[u16(src + y)]; mem8[u16(dest + y)] = b3; mem8[PREV_Y_HI] = b3 >= 0x10 ? b3 | 0xe0 : b3; y = u8(y + 1);
        mem8[DRAW_CURSOR_OFFSET] = y;
        loc_c6c7(m);
      } else {
        for (let c = 0x0b; c >= 0; c--) {
          mem8[u16(dest + y)] = mem8[u16(src + y)];
          y = u8(y + 1);
        }
        mem8[DRAW_CURSOR_OFFSET] = y;
      }
    }

    const idx = mem8[TABLE_CURSOR];
    mem8[u16(LANE_TARGET_FLAG + idx)] = mem8[u16(LANE_TARGET_FLAG + idx)] << 1;
    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] + 1);
    const next = u8(mem8[SLOT_LOOP_INDEX] - 1);
    mem8[SLOT_LOOP_INDEX] = next;
    if (next >= 0x80) break;
  }

  mem8[DRAW_SRC_PTR_HI] = savedHi;
  mem8[DRAW_SRC_PTR_LO] = savedLo;
  loc_df5f(m, u8(mem8[DRAW_CURSOR_OFFSET] - 1));
}
