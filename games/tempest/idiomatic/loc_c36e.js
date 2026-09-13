// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, VG_RECORD_HEADER, DRAW_CURSOR_LO, DRAW_CURSOR_HI,
  DRAW_PATCH_PTR_LO, DRAW_PATCH_PTR_HI, TUBE_GEOM_FLAG, COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B,
} from "./names.js";
import { loc_c772 } from "./loc_c772.js";
import { loc_c423 } from "./loc_c423.js";

// Skip when the gate byte is set; otherwise seat the four record fields from indexed
// tables, emit the header, cache its cursor, then draw one record per pass, bumping the
// index by 0x10 whenever the low nibble saturates.
export function loc_c36e(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  if (a !== 0) return;

  mem8[SLOT_LOOP_INDEX] = y;
  mem8[PROJ_Y_LO] = mem8[u16(COL_SUB_A + y)];
  mem8[PROJ_Y_HI] = mem8[u16(COL_VAL_A + y)];
  mem8[PROJ_X_LO] = mem8[u16(COL_SUB_B + y)];
  mem8[PROJ_X_HI] = mem8[u16(COL_VAL_B + y)];

  loc_c772(m, 0x61);
  mem8[DRAW_PATCH_PTR_LO] = mem8[DRAW_CURSOR_LO];
  mem8[DRAW_PATCH_PTR_HI] = mem8[DRAW_CURSOR_HI];

  const count = mem8[TUBE_GEOM_FLAG] !== 0 ? 0x0e : 0x0f;
  mem8[VG_RECORD_HEADER] = 0xc0;
  mem8[TABLE_CURSOR] = count;

  do {
    let t = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = t;
    if ((t & 0x0f) === 0x0f) mem8[SLOT_LOOP_INDEX] = t + 0x10;
    loc_c423(m);
    mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
  } while ((mem8[TABLE_CURSOR] & 0x80) === 0);
}
