// SPDX-License-Identifier: GPL-3.0-only
/** gatherCharColumnIntoBackingRun — gather one column of the character plane into a thirty-two byte run: the column's
 * twenty-eight cells first, a row apart, then the two two-cell columns beside it. Every address
 * is fixed here, so the column, the two stubs and the run are all this entry's choice, and the
 * run is overwritten whole rather than merged into. LIVE-OUT: memory-only. */

import { CHAR_PLANE_BASE, CHAR_PLANE_COLUMN_BASE, CHAR_PLANE_STUB_LEFT_TOP, CHAR_PLANE_STUB_RIGHT_TOP } from "./names.js";

const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [CHAR_PLANE_STUB_LEFT_TOP, CHAR_PLANE_STUB_RIGHT_TOP];
const STUB_CELLS = 2;

export function gatherCharColumnIntoBackingRun(m) {
  const { mem8 } = m;
  let destination = CHAR_PLANE_BASE;
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[destination++] = mem8[CHAR_PLANE_COLUMN_BASE + i * ROW];
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[destination++] = mem8[stub + i * ROW];
  }
}
