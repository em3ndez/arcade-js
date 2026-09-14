// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PROJ_X_LO, PROJ_Y_LO, COORD_LIST_PTR_LO, SLOT_LOOP_INDEX, VG_RECORD_HEADER, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, GLYPH_PARAM_X, GLYPH_PARAM_Y, GLYPH_PARAM_Z } from "./names.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { drawThreeCharGlyphString } from "./drawThreeCharGlyphString.js";

// Emit a descending run of slot records, seeding each pass's glyph triple from the table.
export function loc_ae4e(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[PROJ_X_LO] = a;
  drawSlotShapeRecord(m, 0x10);
  mem8[PROJ_Y_LO] = 0x01;
  emitScaleWordIfChanged(m, 0x01);
  mem8[COORD_LIST_PTR_LO] = 0x28;
  mem8[SLOT_LOOP_INDEX] = 0x15;
  do {
    loc_ab0d(m);
    mem8[VG_RECORD_HEADER] = 0x00;
    const prev = mem8[COORD_LIST_PTR_LO];
    mem8[COORD_LIST_PTR_LO] = prev - 0x0a;
    emitScaledCoordinateRecord(m, 0xd0, prev);
    emitColorStatIfChanged(m, mem8[PROJ_X_LO] === mem8[SLOT_LOOP_INDEX] ? 0x00 : 0x07);
    emitNibbleDigitRun(m, 0x61, 0x01);
    emitBlankValueRecord(m, 0xa0);
    mem8[VG_RECORD_HEADER] = 0x00;
    emitScaledCoordinateRecord(m, 0x08, 0x00);
    mem8[PROJ_Y_LO] = mem8[PROJ_Y_LO] + 1;
    drawThreeCharGlyphString(m, mem8[SLOT_LOOP_INDEX]);
    emitScaledCoordinateRecord(m, 0x08, 0x00);
    const t = mem8[SLOT_LOOP_INDEX];
    mem8[PROJ_PT_Y] = mem8[u16(GLYPH_PARAM_X + t)];
    mem8[OBJ_DEPTH] = mem8[u16(GLYPH_PARAM_Y + t)];
    mem8[PROJ_PT_X] = mem8[u16(GLYPH_PARAM_Z + t)];
    emitNibbleDigitRun(m, 0x56, 0x03);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 3;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
}
