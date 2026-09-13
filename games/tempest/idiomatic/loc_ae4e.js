// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PROJ_X_LO, PROJ_Y_LO, COORD_LIST_PTR_LO, SLOT_LOOP_INDEX, VG_RECORD_HEADER, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, GLYPH_PARAM_X, GLYPH_PARAM_Y, GLYPH_PARAM_Z } from "./names.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_b0dd } from "./loc_b0dd.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_b0d1 } from "./loc_b0d1.js";
import { loc_dfb1 } from "./loc_dfb1.js";
import { loc_b56a } from "./loc_b56a.js";
import { loc_aef8 } from "./loc_aef8.js";

// Emit a descending run of slot records, seeding each pass's glyph triple from the table.
export function loc_ae4e(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[PROJ_X_LO] = a;
  loc_ab14(m, 0x10);
  mem8[PROJ_Y_LO] = 0x01;
  loc_b0dd(m, 0x01);
  mem8[COORD_LIST_PTR_LO] = 0x28;
  mem8[SLOT_LOOP_INDEX] = 0x15;
  do {
    loc_ab0d(m);
    mem8[VG_RECORD_HEADER] = 0x00;
    const prev = mem8[COORD_LIST_PTR_LO];
    mem8[COORD_LIST_PTR_LO] = prev - 0x0a;
    loc_df75(m, 0xd0, prev);
    loc_b0d1(m, mem8[PROJ_X_LO] === mem8[SLOT_LOOP_INDEX] ? 0x00 : 0x07);
    loc_dfb1(m, 0x61, 0x01);
    loc_b56a(m, 0xa0);
    mem8[VG_RECORD_HEADER] = 0x00;
    loc_df75(m, 0x08, 0x00);
    mem8[PROJ_Y_LO] = mem8[PROJ_Y_LO] + 1;
    loc_aef8(m, mem8[SLOT_LOOP_INDEX]);
    loc_df75(m, 0x08, 0x00);
    const t = mem8[SLOT_LOOP_INDEX];
    mem8[PROJ_PT_Y] = mem8[u16(GLYPH_PARAM_X + t)];
    mem8[OBJ_DEPTH] = mem8[u16(GLYPH_PARAM_Y + t)];
    mem8[PROJ_PT_X] = mem8[u16(GLYPH_PARAM_Z + t)];
    loc_dfb1(m, 0x56, 0x03);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 3;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
}
