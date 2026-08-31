// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { HIGH_SCORE_TABLE, HIGH_SCORE_TABLE_VRAM } from "./names.js";
import { drawStackedCharField } from "./drawStackedCharField.js";
import { splitBcdByte } from "./splitBcdByte.js";
import { renderPanelBcdDigitRows } from "./renderPanelBcdDigitRows.js";
import { renderPanelFromTable } from "./renderPanelFromTable.js";
/**
 * paintAttractHudAndHighScores — repaint the whole numeric side of the attract screen. [seen]
 * ROM 0x03e9 (0x03e9-0x0428).
 *
 * WHAT IT IS
 * ----------
 * The full repaint of the HUD / score panels shown on the attract (idle) screen. It lays down
 * three things in order:
 *   1. eleven canned character fields — the pre-authored banners and points-tally lines of the
 *      attract layout (the "how to play" / scoring text);
 *   2. the ten-entry high-score board, drawn from the packed-BCD high-score table; and
 *   3. the two dressed side panels — the packed-BCD digit stack and the status-tile panel.
 * Together these are everything on the screen that is composed from stored numbers and canned
 * strings rather than from live actors.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is one of the panel/HUD-and-score painters the foreground loop reaches through its
 * display-command handler set: when the queued command that means "repaint the score panels"
 * comes up, this routine runs and rebuilds the whole block in one pass. It does not animate
 * anything itself — it is the composer that stamps the current stored values onto the tilemap.
 *
 * LIVE-OUT: memory only — the painted tilemap cells (the eleven fields, the high-score columns,
 * and the two panels). Nothing is handed back; whatever runs next loads its own state.
 */

// The eleven canned fields are addressed by consecutive selector bytes 0x1a..0x24. Each selector
// picks one pre-authored field (a banner or a points line); drawStackedCharField (ROM 0x05b2)
// chases the ROM script for that field and stamps it into the tilemap.
const FIELD_FIRST = 0x1a; // first field selector; eleven consecutive fields are drawn
const FIELD_COUNT = 0x0b;

// The high-score board is ten entries. Each entry is a 3-byte packed-BCD score, painted as a
// vertical run of six digit tiles one tilemap row apart, and successive entries march to the
// right — so the ten scores become ten side-by-side digit columns.
const ROW_COUNT = 0x0a; //   ten high-score entries
const ROW_STRIDE = 0x20; //  one tilemap row down (a tile row is 0x20 cells wide)
// From the last (most-significant) digit cell of an entry: climb back up the column and step two
// cells right, landing on the base of the next entry's column.
const NEXT_ROW_DELTA = -0x9e; // re-base the column two cells right for the next row (u16-wrapped)

export function paintAttractHudAndHighScores(m) {
  const { mem8 } = m;

  // (1) Canned character fields. Walk the eleven consecutive selectors and stamp each field.
  // These selectors have bit 7 clear, so drawStackedCharField runs in digit-fill mode: every
  // glyph of the pre-authored score/points strings is written as its digit tile.
  for (let i = 0; i < FIELD_COUNT; i++) drawStackedCharField(m, FIELD_FIRST + i);

  // (2) High-score board. `cursor` is the tilemap cell where the current entry's first digit
  // lands (HIGH_SCORE_TABLE_VRAM 0x85c7); `rec` walks the packed-BCD source, three bytes per
  // entry, starting at the sorted high-score table HIGH_SCORE_TABLE (0x8a00).
  let cursor = HIGH_SCORE_TABLE_VRAM;
  let rec = HIGH_SCORE_TABLE;
  for (let row = 0; row < ROW_COUNT; row++) {
    // Each score byte holds two decimal digits (high nibble = tens, low nibble = units).
    // splitBcdByte paints the units digit at the cursor, advances one row down, and hands back
    // the tens digit plus the advanced cursor. The three bytes are consumed least-significant
    // first, so the entry's digits stack down the column with its top place at the far end.

    // First (least-significant) byte: units painted at the cursor; tens painted one row below.
    const [high1, afterLow1] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    mem8[afterLow1] = high1;
    cursor = u16(afterLow1 + ROW_STRIDE); // drop one more row for the next byte's units digit
    rec = u16(rec + 1); //                   advance to the next score byte

    // Middle byte: same unpack, two rows further down the column.
    const [high2, afterLow2] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    mem8[afterLow2] = high2;
    cursor = u16(afterLow2 + ROW_STRIDE);
    rec = u16(rec + 1);

    // Last (most-significant) byte: its tens nibble is the entry's leading digit place, so it is
    // blanked when zero — a six-digit slot then shows e.g. " 10000" rather than "010000".
    const [high3, afterLow3, high3IsZero] = splitBcdByte(m, rec, cursor, ROW_STRIDE);
    if (!high3IsZero) mem8[afterLow3] = high3; // leading-zero suppress on the top digit
    // Re-base to the next entry's column: back up the column and two cells to the right.
    cursor = u16(afterLow3 + NEXT_ROW_DELTA);
    rec = u16(rec + 1);
  }

  // (3) The two side panels. First the packed-BCD digit stack (ROM 0x0439), then the status-tile
  // panel blitted from its work-RAM tile-code table (ROM 0x0460). Both are self-contained painters
  // that source their own pointers; this routine just runs them in sequence to finish the screen.
  renderPanelBcdDigitRows(m);
  renderPanelFromTable(m);
}
