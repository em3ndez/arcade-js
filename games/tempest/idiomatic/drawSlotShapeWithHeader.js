// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_2a, loc_2b, COORD_LIST_PTR_LO, SAVED_INDEX, WORK_PTR_LO, WORK_PTR_HI, VG_LAST_STAT, VG_RECORD_HEADER, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_ac, DRAW_RECORD_PTR_LO, DRAW_RECORD_PTR_HI, SCALE_KEY_TABLE, NIBBLE_GLYPH_TABLE, NIBBLE_GLYPH_TABLE_HI } from "./names.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * drawSlotShapeWithHeader — draw slot x's object record with a caller-supplied header seed. ROM 0xab17.
 *
 * Role in the machine: the object-record drawer shared by the frame-composition entries that want to
 * override an object's colour/header rather than take it from ROM. It is the twin of drawSlotShapeRecord
 * (0xab14) and does exactly the same work — resolve the slot's shape-list pointer, emit the framing
 * header, set colour/scale, expand the point list into the display buffer — except the loc_2b colour/
 * header seed is the argument a instead of ROM loc_d122+x. Callers such as drawFrameWithSlot00 (header
 * 0x30) and drawFrameWithSlot32 (headers 0x00/0xe0) use it to tint a slot for the current frame.
 *
 * Behavior: save the slot index into SAVED_INDEX (loc_35) and seat the header seed loc_2b = a. Load the
 * shape-list pointer from the table based at (loc_ac): lo byte at y=x, hi byte at y+1, into WORK_PTR_LO/HI
 * (loc_3b/3c). For marker slot 0x2c, snapshot the draw cursor (loc_74/75) into DRAW_RECORD_PTR_LO/HI
 * (loc_b6/b7). Seat position loc_2a from the record's first byte, emit the fixed framing word, reset the
 * VG record header, set VG_LAST_STAT=1, emit the blank tag-0x70 word, then the scaled coordinate record
 * from (loc_2a, loc_2b). Reload the shape-list pointer, split the scale key SCALE_KEY_TABLE+SAVED_INDEX
 * (loc_d121+x) into colour (high nibble) and scale (low nibble). Walk the point list from index 1: each
 * entry's low 7 bits index NIBBLE_GLYPH_TABLE lo/hi (loc_31e4/31e5); copy the pair into the display
 * buffer at (DRAW_CURSOR)+outOff, advancing by two; the entry's high bit terminates the list. Close by
 * advancing the cursor by (loc_2a - 1).
 *
 * Live-out: SAVED_INDEX (loc_35), loc_2a/loc_2b, WORK_PTR_LO/HI, COORD_LIST_PTR_LO, VG_RECORD_HEADER,
 * VG_LAST_STAT, the display list grown at the (advanced) draw cursor, and — for slot 0x2c only —
 * DRAW_RECORD_PTR_LO/HI. Grounding: [seen]
 */
export function drawSlotShapeWithHeader(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  mem8[SAVED_INDEX] = x;                               // remember the slot index (loc_35)
  mem8[loc_2b] = a;                                    // colour/header seed = caller's argument
  let y = x;
  mem8[WORK_PTR_LO] = mem8[u16(mem16[loc_ac] + y)];    // shape-list pointer lo from (loc_ac)+x
  y = u8(y + 1);
  mem8[WORK_PTR_HI] = mem8[u16(mem16[loc_ac] + y)];    // ...and the hi byte from the next slot
  if (x === 0x2c) {                                    // marker slot: remember where its record sits
    mem8[DRAW_RECORD_PTR_LO] = mem8[DRAW_CURSOR_LO];
    mem8[DRAW_RECORD_PTR_HI] = mem8[DRAW_CURSOR_HI];
  }
  mem8[loc_2a] = mem8[mem16[WORK_PTR_LO]];             // position byte = record's first byte
  emitFixedVectorWord(m);                              // fixed framing word
  mem8[VG_RECORD_HEADER] = 0x00;
  mem8[VG_LAST_STAT] = 0x01;
  emitBlankVectorWordTag70(m, 0x01); // A = 0x01, the value just stored to VG_LAST_STAT
  emitScaledCoordinateRecord(m, mem8[loc_2a], mem8[loc_2b]);
  y = mem8[SAVED_INDEX];                               // reload the shape-list pointer (consumed above)
  mem8[WORK_PTR_LO] = mem8[u16(mem16[loc_ac] + y)];
  y = u8(y + 1);
  mem8[WORK_PTR_HI] = mem8[u16(mem16[loc_ac] + y)];
  const key = mem8[u16(SCALE_KEY_TABLE + mem8[SAVED_INDEX])]; // packed scale key loc_d121+x
  emitColorStatIfChanged(m, key >> 4);                 // high nibble → colour stat
  emitScaleWordIfChanged(m, key & 0x0f);               // low nibble → scale
  mem8[loc_2a] = 0x00;                                 // reset output offset into the buffer
  let listIdx = 0x01;                                  // point list starts at index 1
  let entry;
  do {
    entry = mem8[u16(mem16[WORK_PTR_LO] + listIdx)];   // next glyph list entry
    mem8[loc_2b] = entry;
    const src = entry & 0x7f;                          // low 7 bits index the glyph tables
    listIdx = u8(listIdx + 1);
    mem8[COORD_LIST_PTR_LO] = listIdx;
    let outOff = mem8[loc_2a];
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE + src)];    // lo glyph byte
    outOff = u8(outOff + 1);
    mem8[u16(mem16[DRAW_CURSOR_LO] + outOff)] = mem8[u16(NIBBLE_GLYPH_TABLE_HI + src)]; // hi glyph byte
    outOff = u8(outOff + 1);
    mem8[loc_2a] = outOff;
  } while ((entry & 0x80) === 0);                      // high bit terminates the list
  advanceDisplayCursor(m, u8(mem8[loc_2a] - 1));       // close: advance cursor past what we wrote
}
