// SPDX-License-Identifier: GPL-3.0-only
/**
 * restoreColumnFromSavedRun — put a saved thirty-two cell picture back onto the character plane.
 *
 * WHAT IT IS: ROM routine 0x1563 [seen]. It reads a thirty-two byte run and scatters it down the
 * character plane: the first twenty-eight bytes go into one column of cells a row apart, the last four
 * into two short two-cell columns beside it, each byte again a row below the one before it. Every
 * address is fixed here -- the run it reads, the column it lays and the two stubs are all this entry's
 * choice, not a caller's -- and it overwrites the cells whole rather than merging into them.
 *
 * ROLE IN THE MACHINE: the run it reads, CHAR_PLANE_BASE onward (the first thirty-two cells), is the
 * top row of video RAM, which the hardware never displays (the visible window is rows 2 through 29 of
 * the 32x32 map) -- so that row is a hidden backing store, not a picture. The scripted character-plane
 * band ticks (advanceScriptedCharPlaneBandTo2 / advanceScriptedCharPlaneBandTo4) call THIS routine near
 * the top of a tick, edit cells of the same column, then call its exact inverse
 * gatherCharColumnIntoBackingRun near the bottom: the column is the working copy, the hidden row is
 * where it survives whatever else draws over the screen between ticks.
 *
 * ON THE GLASS: the monitor is rotated, so the fixed video-RAM column (column 17, rows 2-29) shows as a
 * full-width horizontal line, and the four stub cells (columns 16 and 18, rows 15 and 16) are the
 * warp-band flare corners, two above the line and two below it, centred.
 *
 * LIVE-OUT: memory only -- the twenty-eight column cells and the four stub cells.
 */

import { CHAR_PLANE_BASE, CHAR_PLANE_COLUMN_BASE, CHAR_PLANE_STUB_UPPER_RIGHT, CHAR_PLANE_STUB_LOWER_RIGHT } from "./names.js";

/** One row down the character plane: the map is thirty-two cells wide, so the cell below is 0x20 on. */
const ROW = 0x20;
/** The column's length: rows 2 through 29, exactly the visible height of the plane. */
const COLUMN_CELLS = 28;
/** The two flare-corner stubs, each the top of a two-cell column (row 15, with row 16 below it). */
const STUB_COLUMNS = [CHAR_PLANE_STUB_UPPER_RIGHT, CHAR_PLANE_STUB_LOWER_RIGHT];
const STUB_CELLS = 2;

export function restoreColumnFromSavedRun(m) {
  const { mem8 } = m;
  // One source cursor walks the saved run straight through, a byte at a time, for all thirty-two
  // bytes; only the DESTINATION jumps around. The ROM keeps that cursor in DE and uses the alternate
  // register set for the loop count, the same split this single running index expresses.
  let source = CHAR_PLANE_BASE;
  // Step 1: the long column. Twenty-eight bytes, each laid one row (0x20) below the last, starting at
  // the column's top cell -- the ROM's `add hl,bc` with BC = 0x20 under a `djnz` count of 0x1C.
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[CHAR_PLANE_COLUMN_BASE + i * ROW] = mem8[source++];
  // Step 2: the four remaining bytes go to the two flare-corner stubs, two cells each, the second cell
  // one row below the first. The order (upper-right stub pair first, then lower-right) is the order
  // gatherCharColumnIntoBackingRun saves them in, which is what makes the pair exact inverses.
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[stub + i * ROW] = mem8[source++];
  }
}
