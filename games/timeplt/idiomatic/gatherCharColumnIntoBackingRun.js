// SPDX-License-Identifier: GPL-3.0-only
/** gatherCharColumnIntoBackingRun — gather one column of the character plane into a thirty-two byte run: the column's
 * twenty-eight cells first, a row apart, then the two two-cell columns beside it. Every address
 * is fixed here, so the column, the two stubs and the run are all this entry's choice, and the
 * run is overwritten whole rather than merged into. LIVE-OUT: memory-only. */

import { loc_a400, loc_a451, loc_a5f0, loc_a5f2 } from "./names.js";

const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [loc_a5f0, loc_a5f2];
const STUB_CELLS = 2;

export function gatherCharColumnIntoBackingRun(m) {
  const { mem8 } = m;
  let destination = loc_a400;
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[destination++] = mem8[loc_a451 + i * ROW];
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[destination++] = mem8[stub + i * ROW];
  }
}
