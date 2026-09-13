// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, LANE_TARGET_FLAG, LANE_LIMIT, SEG_MID_X, SEG_MID_Y, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X,
  POKEY1_RANDOM, DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_OFFSET, BLANK_SLOT_VEC_LO, BLANK_SLOT_VEC_HI, OBJ_TEMPLATE_WORD_LO, OBJ_TEMPLATE_WORD_HI,
} from "./names.js";
import { loc_c453 } from "./loc_c453.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c73c } from "./loc_c73c.js";
import { loc_bd3e } from "./loc_bd3e.js";

// Emit a vector-list entry for the active slot. When its kind byte is zero, write four
// blank/marker pairs; otherwise seat the scratch inputs, run the delta passes, then append
// either a randomly chosen table word or a fixed marker word, advancing the write cursor.
export function loc_c6c7(m) {
  const { mem8 } = m;
  const x = mem8[TABLE_CURSOR];
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);

  if (mem8[u16(LANE_LIMIT + x)] === 0) {
    // Inactive slot: four blank+0x71 pairs from the current cursor.
    let y = mem8[DRAW_CURSOR_OFFSET];
    for (let i = 0; i < 4; i++) {
      mem8[u16(base + y)] = 0x00; y = u8(y + 1);
      mem8[u16(base + y)] = 0x71; y = u8(y + 1);
    }
    mem8[DRAW_CURSOR_OFFSET] = y;
    return;
  }

  // Active slot: seat scratch fields and run the delta/coprocessor passes.
  mem8[OBJ_DEPTH] = mem8[u16(LANE_LIMIT + x)];
  loc_c453(m);
  mem8[PROJ_PT_Y] = mem8[u16(SEG_MID_X + x)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_MID_Y + x)];
  loc_c098(m);
  loc_c73c(m);

  const kind = mem8[u16(LANE_TARGET_FLAG + mem8[TABLE_CURSOR])] & 0x40;
  let y = mem8[DRAW_CURSOR_OFFSET];
  if (kind !== 0) {
    // Randomized word: a random even offset selects one of two adjacent table words.
    loc_bd3e(m);
    const idx = (mem8[POKEY1_RANDOM] & 0x02) + 0x1c;
    mem8[u16(base + u8(y + 1))] = mem8[u16(OBJ_TEMPLATE_WORD_HI + idx)];
    mem8[u16(base + y)] = mem8[u16(OBJ_TEMPLATE_WORD_LO + idx)];
    mem8[DRAW_CURSOR_OFFSET] = u8(y + 2);
    return;
  }

  // Fixed marker word.
  mem8[u16(base + y)] = 0x00; y = u8(y + 1);
  mem8[u16(base + y)] = 0x68; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[BLANK_SLOT_VEC_LO]; y = u8(y + 1);
  mem8[u16(base + y)] = mem8[BLANK_SLOT_VEC_HI]; y = u8(y + 1);
  mem8[DRAW_CURSOR_OFFSET] = y;
}
