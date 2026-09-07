// SPDX-License-Identifier: GPL-3.0-only

/**
 * blankTileColumns (ROM 0x03c0) — blank a run of B tilemap columns.
 *
 * WHAT IT IS
 *   For each of `columns` columns (the Z80 B register), it stamps the blank tile (0x10) into three VRAM
 *   cells stepping up one tile row (−32) each, then advances the write pointer to the next column and
 *   repeats, as a djnz loop — so a count of 0 wraps to 256 columns.
 *
 * ROLE IN THE MACHINE
 *   The blank half of the periodic tile-column repaint: redrawTileColumnsPeriodically (0x0367) calls this
 *   in its blank phase and drawTileColumnTriple in its draw phase, gated by DRAWN_COLUMN_COUNT (0x4241) and
 *   the frame-counter phase (mechanisms.md). Addressing is the raw Z80 pointer math: HL starts at loc_5193;
 *   −32 (ROW_STEP) walks up one tile row as a full 16-bit subtract that borrows into the high byte (u16);
 *   and +98 (COLUMN_STEP) advances to the next column touching only the low byte — exactly the low-byte-only
 *   pointer update the ROM does.
 *
 * ROM 0x03c0.  Grounding: [seen].
 *
 * LIVE-OUT: memory only — three blanked cells (tile 0x10) in each of the swept columns of tilemap VRAM.
 */
import { u16 } from "../../../core/int.js";
import { loc_5193 } from "./names.js";

const BLANK_TILE = 16;
const ROW_STEP = 32;         // one row up (VRAM stride)
const COLUMN_STEP = 98;      // low-byte advance to the next column
const ROWS_PER_COLUMN = 3;

export function blankTileColumns(m, columns = m.regs.b) {
  const { mem8 } = m;
  // HL is the running VRAM write pointer (starts at the first column top); remaining is the djnz counter.
  let hl = loc_5193;
  let remaining = columns;

  // One iteration per column.
  do {
    // Blank three cells up this column: stamp the blank tile, then step the pointer up one row (−32),
    // which is a 16-bit subtract that can borrow into the high byte (u16 keeps it inside 0..0xffff).
    for (let row = 0; row < ROWS_PER_COLUMN; row++) {
      mem8[hl] = BLANK_TILE;
      hl = u16(hl - ROW_STEP);
    }
    // Move to the next column: the ROM adds 98 into the low byte only, leaving the high byte untouched.
    hl = ((hl >> 8) << 8) | ((hl + COLUMN_STEP) & 0xff); // next column: only the low byte advances
    remaining = (remaining - 1) & 0xff;                  // djnz wraps 0 -> 256 columns
  } while (remaining !== 0);
}
