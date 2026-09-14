// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_2a, loc_2b, COORD_LIST_PTR_LO, SAVED_INDEX, WORK_PTR_LO, WORK_PTR_HI, VG_LAST_STAT, VG_RECORD_HEADER, DRAW_CURSOR_LO, loc_ac, SCALE_KEY_TABLE, NIBBLE_GLYPH_TABLE, NIBBLE_GLYPH_TABLE_HI } from "./names.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * expandShapeListToVectors — expand a shape's coordinate list into vector-generator records. ROM 0xab3b.
 *
 * Role in the machine: everything on Tempest's screen is drawn by the vector generator (VG) from a list of
 * records in display RAM. A "shape" is stored compactly as a coordinate list; to draw it the game must emit
 * a VG header, a scaled beam-position move, colour/scale settings, and then one record per point. This is
 * the shared tail all three shape builders converge on once the position/colour/slot cells (loc_2a, loc_2b,
 * loc_35 = SAVED_INDEX) have been pre-seeded — it does the actual expansion into the output buffer.
 *
 * Behavior: it seeds the VG record header — clear loc_73 (VG_RECORD_HEADER), set loc_72 (VG_LAST_STAT) =
 * 0x01 — and emits the intensity/blank header word (emitBlankVectorWordTag70, folded as a|0x70) and the
 * scaled beam-position record from loc_2a/loc_2b (emitScaledCoordinateRecord). It then reloads this shape's
 * coordinate-list pointer into loc_74-adjacent WORK_PTR_LO/HI from the table at (loc_ac)+SAVED_INDEX (two
 * successive bytes), and reads the packed scale key from SCALE_KEY_TABLE (loc_d121) + SAVED_INDEX, splitting
 * it into a colour stat (high nibble -> emitColorStatIfChanged) and a scale word (low nibble ->
 * emitScaleWordIfChanged). Then it walks the shape list from index 1: each entry's low 7 bits (src) index a
 * split glyph table (NIBBLE_GLYPH_TABLE / _HI = loc_31e4/loc_31e5) whose low and high bytes are copied as a
 * point pair into the draw buffer (DRAW_CURSOR_LO, loc_74) at the running output offset loc_2a; the loop
 * ends when an entry's high bit (0x80) marks the terminator. Finally advanceDisplayCursor closes the record,
 * advancing by the emitted length minus one.
 *
 * Live-out: the expanded VG records in the (loc_74) draw buffer; loc_72/loc_73 header cells; loc_2a =
 * final output offset; loc_2b = last entry; COORD_LIST_PTR_LO = last list index; WORK_PTR_LO/HI = the
 * reloaded shape pointer; and the advanced display cursor. Grounding: [seen].
 */
// Draw a scaled vector list: seed the header, set scale from a split table nibble,
// copy indexed point pairs into the output buffer until a high-bit terminator, then close.
export function expandShapeListToVectors(m) {
  const { mem8, mem16 } = m;
  mem8[VG_RECORD_HEADER] = 0x00;                     // clear the record header
  mem8[VG_LAST_STAT] = 0x01;                         // seed last-stat = 0x01 (also the header live-in)
  emitBlankVectorWordTag70(m, 0x01); // A live-in = the 0x01 just loaded (STA $72); df6a folds it as a|0x70
  emitScaledCoordinateRecord(m, mem8[loc_2a], mem8[loc_2b]); // scaled beam-position move
  let y = mem8[SAVED_INDEX];
  mem8[WORK_PTR_LO] = mem8[u16(mem16[loc_ac] + y)]; // reload shape-list pointer lo from (loc_ac)+index
  y = u8(y + 1);
  mem8[WORK_PTR_HI] = mem8[u16(mem16[loc_ac] + y)]; // ...and hi from the next table byte
  const key = mem8[u16(SCALE_KEY_TABLE + mem8[SAVED_INDEX])]; // packed colour|scale key for this shape
  emitColorStatIfChanged(m, key >> 4);              // high nibble -> colour stat
  emitScaleWordIfChanged(m, key & 0x0f);            // low nibble -> scale word
  mem8[loc_2a] = 0x00;                              // reset output offset
  let listIdx = 0x01;                              // walk the shape list from entry 1
  let entry;
  do {
    entry = mem8[u16(mem16[WORK_PTR_LO] + listIdx)];
    mem8[loc_2b] = entry;
    const src = entry & 0x7f;                       // low 7 bits index the glyph table
    listIdx = u8(listIdx + 1);
    mem8[COORD_LIST_PTR_LO] = listIdx;
    let outOff = mem8[loc_2a];
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE + src)];    // point lo byte
    outOff = u8(outOff + 1);
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE_HI + src)]; // point hi byte
    outOff = u8(outOff + 1);
    mem8[loc_2a] = outOff;
  } while ((entry & 0x80) === 0);                    // high bit terminates the list
  advanceDisplayCursor(m, u8(mem8[loc_2a] - 1));     // close the record (length - 1)
}
