// SPDX-License-Identifier: GPL-3.0-only
/** restoreColumnFromSavedRun — scatter a thirty-two byte run down the character plane. The first twenty-eight
 * bytes go into one column, a row apart; the last four go into two two-cell columns of their
 * own, each byte again a row below the one before it. Every address is fixed here, so the run,
 * the column and the two stubs are all this entry's choice. LIVE-OUT: memory-only. */

import { loc_a400, loc_a451, loc_a5f0, loc_a5f2 } from "./names.js";

const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [loc_a5f0, loc_a5f2];
const STUB_CELLS = 2;

export function restoreColumnFromSavedRun(m) {
  const { mem8 } = m;
  let source = loc_a400;
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[loc_a451 + i * ROW] = mem8[source++];
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[stub + i * ROW] = mem8[source++];
  }
}
