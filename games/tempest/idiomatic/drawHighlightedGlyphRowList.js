// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PROJ_X_LO, PROJ_Y_LO, COORD_LIST_PTR_LO, SLOT_LOOP_INDEX, VG_RECORD_HEADER, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, GLYPH_PARAM_X, GLYPH_PARAM_Y, GLYPH_PARAM_Z } from "./names.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";
import { emitBlankValueRecord } from "./emitBlankValueRecord.js";
import { drawThreeCharGlyphString } from "./drawThreeCharGlyphString.js";

/**
 * drawHighlightedGlyphRowList — draw a descending run of glyph rows, highlighting one. ROM 0xae4e.
 *
 * Role in the machine: this paints a vertical list of glyph rows (a menu / status column of the vector
 * display), one row per pass, marching down the screen. Exactly one row — the one whose index matches
 * the argument a — is drawn in the highlight colour while the rest are drawn in the normal tint, which
 * is how the currently-selected line is shown. Each row also carries a three-character glyph string and
 * a three-value numeric run seeded from per-row parameter tables.
 *
 * Behavior: it stashes the highlight key a into PROJ_X_LO, primes the pen with slot 0x10, sets the row
 * base PROJ_Y_LO=0x01, and emits the scale word (emitScaleWordIfChanged(0x01)). It seeds the column
 * cursor COORD_LIST_PTR_LO=0x28 and the row index SLOT_LOOP_INDEX=0x15, then loops: each pass emits a
 * fixed vector word, zeroes the VG record header, steps the column cursor back 0x0a and positions the
 * row (emitScaledCoordinateRecord(0xd0, prev)). It picks the tint via emitColorStatIfChanged — 0x00
 * (highlight) when the row index SLOT_LOOP_INDEX equals the key PROJ_X_LO, else 0x07 (normal). It emits
 * a one-digit run, a blank value record, advances the row (PROJ_Y_LO++), draws the three-char glyph
 * string for this row (drawThreeCharGlyphString(SLOT_LOOP_INDEX)), and re-seats the numeric triple
 * PROJ_PT_Y / OBJ_DEPTH / PROJ_PT_X from the per-row parameter tables GLYPH_PARAM_X/Y/Z indexed by the
 * row, then emits a three-digit run. It drops the row index by 3 and continues while it has not
 * underflowed past 0x80 (the < 0x80 test detects the wrap below zero).
 *
 * Live-out: PROJ_X_LO (highlight key), PROJ_Y_LO (final row), COORD_LIST_PTR_LO (column cursor),
 * SLOT_LOOP_INDEX (wrapped past 0), the PROJ_PT_Y/OBJ_DEPTH/PROJ_PT_X triple from the last row, and the
 * full run of glyph-row records appended to the display list. Grounding: [seen].
 */
export function drawHighlightedGlyphRowList(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[PROJ_X_LO] = a;                    // remember which row to highlight
  drawSlotShapeRecord(m, 0x10);           // prime the pen with a fixed slot
  mem8[PROJ_Y_LO] = 0x01;                 // row base position
  emitScaleWordIfChanged(m, 0x01);        // set the drawing scale
  mem8[COORD_LIST_PTR_LO] = 0x28;         // column cursor start
  mem8[SLOT_LOOP_INDEX] = 0x15;           // top row index; steps down by 3
  do {
    emitFixedVectorWord(m);
    mem8[VG_RECORD_HEADER] = 0x00;
    const prev = mem8[COORD_LIST_PTR_LO];
    mem8[COORD_LIST_PTR_LO] = prev - 0x0a; // step the column cursor back one row
    emitScaledCoordinateRecord(m, 0xd0, prev); // position this row
    // Highlight tint 0x00 when this row is the selected one, else normal tint 0x07.
    emitColorStatIfChanged(m, mem8[PROJ_X_LO] === mem8[SLOT_LOOP_INDEX] ? 0x00 : 0x07);
    emitNibbleDigitRun(m, 0x61, 0x01);
    emitBlankValueRecord(m, 0xa0);
    mem8[VG_RECORD_HEADER] = 0x00;
    emitScaledCoordinateRecord(m, 0x08, 0x00);
    mem8[PROJ_Y_LO] = mem8[PROJ_Y_LO] + 1;  // advance down a row
    drawThreeCharGlyphString(m, mem8[SLOT_LOOP_INDEX]); // this row's 3-char label
    emitScaledCoordinateRecord(m, 0x08, 0x00);
    const t = mem8[SLOT_LOOP_INDEX];
    // Re-seat the numeric triple for this row from the per-row parameter tables.
    mem8[PROJ_PT_Y] = mem8[u16(GLYPH_PARAM_X + t)];
    mem8[OBJ_DEPTH] = mem8[u16(GLYPH_PARAM_Y + t)];
    mem8[PROJ_PT_X] = mem8[u16(GLYPH_PARAM_Z + t)];
    emitNibbleDigitRun(m, 0x56, 0x03);      // three-value numeric run
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 3; // next row up the table
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);   // stop once the index wraps below zero
}
