// SPDX-License-Identifier: GPL-3.0-only
/** gatherCharColumnIntoBackingRun — gather one column of the character plane into a thirty-two byte run: the column's
 * twenty-eight cells first, a row apart, then the two two-cell columns beside it. Every address
 * is fixed here, so the column, the two stubs and the run are all this entry's choice, and the
 * run is overwritten whole rather than merged into. LIVE-OUT: memory-only.
 *
 * ROM 0x158C-0x15B4 (lift: translated/loc_158c.js). Grounding: [seen].
 *
 * Role in the machine: the between-eras band animation draws a streak across the screen by
 * mutating one video-RAM column (CHAR_PLANE_COLUMN_BASE 0xA451, column 17). Under the board's ROT90
 * a fixed video-RAM column is a horizontal line on the glass, and the four stub cells
 * (CHAR_PLANE_STUB_UPPER_RIGHT 0xA5F0 / LOWER_RIGHT 0xA5F2 and their left twins) are the flare
 * corners beside it. The run it saves into, CHAR_PLANE_BASE 0xA400-0xA41F, is the first row of
 * the character plane, which the driver never displays (its visible window is rows 2-29) — so it
 * is a backing store, not a picture. advanceScriptedCharPlaneBandTo2 and ...To4 each call the
 * inverse, restoreColumnFromSavedRun (0x1563), near the top of a tick, mutate the column, and
 * call THIS near the bottom, so the working column survives whatever else draws over the screen.
 * It is the exact inverse of that routine over the same cells in the same order.
 */

import { CHAR_PLANE_BASE, CHAR_PLANE_COLUMN_BASE, CHAR_PLANE_STUB_UPPER_RIGHT, CHAR_PLANE_STUB_LOWER_RIGHT } from "./names.js";

// One tilemap row is 0x20 cells. The column spans twenty-eight rows (`ld b,0x1c`); each stub is
// two cells, one row apart (the stub at 0xA5F0 and the one below it at 0xA610; 0xA5F2 and 0xA612).
const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [CHAR_PLANE_STUB_UPPER_RIGHT, CHAR_PLANE_STUB_LOWER_RIGHT];
const STUB_CELLS = 2;

export function gatherCharColumnIntoBackingRun(m) {
  const { mem8 } = m;
  // The column first: read a cell, write it to the next byte of the run, step one row down
  // (the ROM's `ld a,(hl) / ld (de),a / inc de / add hl,bc` loop, BC = 0x20).
  let destination = CHAR_PLANE_BASE;
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[destination++] = mem8[CHAR_PLANE_COLUMN_BASE + i * ROW];
  // Then the two stubs, two cells each, appended in the same order the restore reads them back
  // (ROM 0x15A1-0x15B3): run bytes 28-31.
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[destination++] = mem8[stub + i * ROW];
  }
}
