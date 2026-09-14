// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_2a, loc_2b, COORD_LIST_PTR_LO, SAVED_INDEX, WORK_PTR_LO, WORK_PTR_HI, VG_LAST_STAT, VG_RECORD_HEADER, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_ac, DRAW_RECORD_PTR_LO, DRAW_RECORD_PTR_HI, SCALE_KEY_TABLE, HEADER_COLOR_SEED, NIBBLE_GLYPH_TABLE, NIBBLE_GLYPH_TABLE_HI } from "./names.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * drawSlotShapeRecord — draw slot x's object record into the display list. ROM 0xab14.
 *
 * Role in the machine: every drawable object (an enemy, the cursor/marker, a score glyph run) is
 * built from a shape record — a header plus a list of coordinate glyph indices. This routine takes
 * a slot index x, looks the record up through the per-slot shape-list pointer table, emits its
 * framing header at the current draw cursor, sets colour and scale, and then expands the record's
 * point list into the display buffer. Its colour/header seed comes from a ROM table indexed by the
 * slot (that is the only difference from drawSlotShapeWithHeader, which takes the seed as an arg).
 *
 * Behavior: read the colour/header seed HEADER_COLOR_SEED+x (ROM loc_d122+x) into loc_2b and save
 * the slot index into SAVED_INDEX (loc_35). Load the slot's shape-list pointer from the table based
 * at (loc_ac): the low byte at index y=x, the high byte at y+1, into WORK_PTR_LO/HI (loc_3b/3c). For
 * the marker slot 0x2c, snapshot the current draw cursor (DRAW_CURSOR_LO/HI, loc_74/75) into
 * DRAW_RECORD_PTR_LO/HI (loc_b6/b7) so a later pass can find this record. Seat the position byte
 * loc_2a from the record's first byte, emit the fixed framing word (emitFixedVectorWord), reset the
 * VG record header and set VG_LAST_STAT=1, emit the blank tag-0x70 word, then emit the scaled
 * coordinate record from (loc_2a, loc_2b). Reload the shape-list pointer (it was consumed), split
 * the scale key SCALE_KEY_TABLE+SAVED_INDEX (loc_d121+x): high nibble → colour (emitColorStatIfChanged),
 * low nibble → scale (emitScaleWordIfChanged). Then walk the point list starting at index 1: each
 * entry's low 7 bits index the NIBBLE_GLYPH_TABLE lo/hi tables (loc_31e4/31e5); copy the pair into
 * the display buffer at (DRAW_CURSOR)+outOff, advancing outOff by two and tracking it in loc_2a; the
 * entry's high bit is the list terminator. Close by advancing the cursor by (loc_2a - 1).
 *
 * Live-out: SAVED_INDEX (loc_35), loc_2a/loc_2b, WORK_PTR_LO/HI, COORD_LIST_PTR_LO, VG_RECORD_HEADER,
 * VG_LAST_STAT, the display list grown at the draw cursor (advanced), and — for slot 0x2c only —
 * DRAW_RECORD_PTR_LO/HI. Grounding: [seen]
 */
export function drawSlotShapeRecord(m, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const tableVal = mem8[u16(HEADER_COLOR_SEED + x)];   // colour/header seed from ROM loc_d122+x
  mem8[SAVED_INDEX] = x;                                // remember the slot index (loc_35)
  mem8[loc_2b] = tableVal;
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
