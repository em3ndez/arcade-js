// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_02, loc_03, loc_04, loc_8d, loc_91, loc_92 } from "./names.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotZpTableByteAtCursor } from "./plotZpTableByteAtCursor.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";

/**
 * plotRecordFieldColumns -- draw a header row, then lay out a table of three-byte records column by column.
 * Each record prints its three fields as digit pairs (through the kept print sub) then plots three glyph
 * bytes from the zero-page table, advancing the draw cursor; the column base steps from the prior cursor
 * low bits. Records are walked in threes until the record index reaches 0x18. [code]
 */
export function plotRecordFieldColumns(m) {
  const { mem8 } = m;
  writePointerTableRow(m, 0x07); // header row

  let col = 0x5c;
  let base = 0x00;
  for (;;) {
    mem8[loc_91] = col; // draw-cursor low = column base
    mem8[loc_92] = 0x05; // draw-cursor high
    mem8[loc_8d] = base; // record index cell, reloaded after each kept call

    // Leading-digit gate set for the first field; the second field reseats nothing (2d76 has no
    // sec/clc) so it inherits the first field's carry-out (set only when the first byte was all-zero
    // digits); the third field is cleared (2d82 clc).
    const gate2 = plotByteAsTwoDigits(m, mem8[loc_04 + mem8[loc_8d]], true);
    plotByteAsTwoDigits(m, mem8[loc_03 + mem8[loc_8d]], gate2);
    plotByteAsTwoDigits(m, mem8[loc_02 + mem8[loc_8d]], false);

    writeMaskedByteAndAdvancePointer(m, 0x00); // blank separator cell
    plotZpTableByteAtCursor(m, mem8[loc_8d]); // three glyph bytes for this record
    mem8[loc_8d] = u8(mem8[loc_8d] + 1);
    plotZpTableByteAtCursor(m, mem8[loc_8d]);
    mem8[loc_8d] = u8(mem8[loc_8d] + 1);
    plotZpTableByteAtCursor(m, mem8[loc_8d]);

    col = u8(((mem8[loc_91] & 0x1f) | 0x40) - 1); // next column base from the advanced cursor
    base = u8(mem8[loc_8d] + 1);
    if (base >= 0x18) return;
  }
}
