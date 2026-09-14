// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_2a, loc_2b, COORD_LIST_PTR_LO, SAVED_INDEX, WORK_PTR_LO, WORK_PTR_HI, VG_LAST_STAT, VG_RECORD_HEADER, DRAW_CURSOR_LO, loc_ac, SCALE_KEY_TABLE, NIBBLE_GLYPH_TABLE, NIBBLE_GLYPH_TABLE_HI } from "./names.js";
import { loc_df6a } from "./loc_df6a.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

// Draw a scaled vector list: seed the header, set scale from a split table nibble,
// copy indexed point pairs into the output buffer until a high-bit terminator, then close.
export function expandShapeListToVectors(m) {
  const { mem8, mem16 } = m;
  mem8[VG_RECORD_HEADER] = 0x00;
  mem8[VG_LAST_STAT] = 0x01;
  loc_df6a(m, 0x01); // A live-in = the 0x01 just loaded (STA $72); df6a folds it as a|0x70
  emitScaledCoordinateRecord(m, mem8[loc_2a], mem8[loc_2b]);
  let y = mem8[SAVED_INDEX];
  mem8[WORK_PTR_LO] = mem8[u16(mem16[loc_ac] + y)];
  y = u8(y + 1);
  mem8[WORK_PTR_HI] = mem8[u16(mem16[loc_ac] + y)];
  const key = mem8[u16(SCALE_KEY_TABLE + mem8[SAVED_INDEX])];
  emitColorStatIfChanged(m, key >> 4);
  emitScaleWordIfChanged(m, key & 0x0f);
  mem8[loc_2a] = 0x00;
  let listIdx = 0x01;
  let entry;
  do {
    entry = mem8[u16(mem16[WORK_PTR_LO] + listIdx)];
    mem8[loc_2b] = entry;
    const src = entry & 0x7f;
    listIdx = u8(listIdx + 1);
    mem8[COORD_LIST_PTR_LO] = listIdx;
    let outOff = mem8[loc_2a];
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE + src)];
    outOff = u8(outOff + 1);
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE_HI + src)];
    outOff = u8(outOff + 1);
    mem8[loc_2a] = outOff;
  } while ((entry & 0x80) === 0);
  advanceDisplayCursor(m, u8(mem8[loc_2a] - 1));
}
