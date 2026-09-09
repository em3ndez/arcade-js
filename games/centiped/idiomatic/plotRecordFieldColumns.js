// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_02, loc_03, loc_04, loc_8d, loc_91, loc_92 } from "./names.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotZpTableByteAtCursor } from "./plotZpTableByteAtCursor.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";

/**
 * plotRecordFieldColumns -- render the whole sorted-object table onto the screen as a grid, one
 * three-byte record per column.
 *
 * Role in the machine: this is the display half of the object-table subsystem. `buildSortedObjectTable`
 * keeps a key-sorted table of active objects as three-byte records based at `loc_02`, with a parallel
 * glyph block based at `loc_1a`; this routine paints that table. It is called both from the game entry
 * (to lay down the static playfield scaffolding) and whenever the sort routine finishes rebuilding, so
 * what shows on screen always reflects the current sorted table.
 *
 * Per column it: seats the draw cursor at the running column base, prints the record's three number
 * fields (from the `loc_02`/`loc_03`/`loc_04` field planes) as digit pairs, writes a blank separator,
 * then plots three glyph bytes for the record from the `loc_1a` zero-page table via
 * `plotZpTableByteAtCursor`. The next column base is derived from the advanced cursor's low bits, and
 * records are walked in threes until the record index reaches 0x18 (eight records). [code]
 *
 * Grounding: [code]. Live-out: none returned; the whole effect is the drawn grid.
 */
export function plotRecordFieldColumns(m) {
  const { mem8 } = m;
  writePointerTableRow(m, 0x07); // header row

  // `col` is the running draw-cursor low byte (column base); it starts at 0x5c and steps left each
  // column. `base` is the record index into the field/glyph planes, stepping by three per record.
  let col = 0x5c;
  let base = 0x00;
  for (;;) {
    mem8[loc_91] = col; // draw-cursor low = column base
    mem8[loc_92] = 0x05; // draw-cursor high
    mem8[loc_8d] = base; // record index cell, reloaded after each kept call

    // Print the three number fields of this record as two-digit pairs, threading leading-zero
    // suppression across them. The first field opens with the leading-digit gate set (carry true).
    // The second field reseats nothing (ROM at 0x2d76 has no sec/clc) so it INHERITS the first
    // field's carry-out (set only when the first byte was all-zero digits); the third field is
    // forced visible (ROM 0x2d82 issues clc -> carry false).
    const gate2 = plotByteAsTwoDigits(m, mem8[loc_04 + mem8[loc_8d]], true);
    plotByteAsTwoDigits(m, mem8[loc_03 + mem8[loc_8d]], gate2);
    plotByteAsTwoDigits(m, mem8[loc_02 + mem8[loc_8d]], false);

    // One blank cell separates the numbers from the glyphs, then lay this record's three glyph
    // bytes out of the loc_1a table -- bumping the record index (loc_8d) between each so successive
    // glyph rows of the same record are read.
    writeMaskedByteAndAdvancePointer(m, 0x00); // blank separator cell
    plotZpTableByteAtCursor(m, mem8[loc_8d]); // three glyph bytes for this record
    mem8[loc_8d] = u8(mem8[loc_8d] + 1);
    plotZpTableByteAtCursor(m, mem8[loc_8d]);
    mem8[loc_8d] = u8(mem8[loc_8d] + 1);
    plotZpTableByteAtCursor(m, mem8[loc_8d]);

    // Next column base comes from the cursor the glyph plots just advanced: keep its low 5 bits,
    // force bit 6 on, step back one -- landing the next column just left of this one. Advance the
    // record index past the three glyph bytes and stop once we have walked all eight records (0x18).
    col = u8(((mem8[loc_91] & 0x1f) | 0x40) - 1); // next column base from the advanced cursor
    base = u8(mem8[loc_8d] + 1);
    if (base >= 0x18) return;
  }
}
