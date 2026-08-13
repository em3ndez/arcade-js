// SPDX-License-Identifier: GPL-3.0-only
/** restoreColumnFromSavedRun — scatter a thirty-two byte run down the character plane. The first twenty-eight
 * bytes go into one column, a row apart; the last four go into two two-cell columns of their
 * own, each byte again a row below the one before it. Every address is fixed here, so the run,
 * the column and the two stubs are all this entry's choice. LIVE-OUT: memory-only. */

import { CHAR_PLANE_BASE, CHAR_PLANE_COLUMN_BASE, CHAR_PLANE_STUB_LEFT_TOP, CHAR_PLANE_STUB_RIGHT_TOP } from "./names.js";

const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [CHAR_PLANE_STUB_LEFT_TOP, CHAR_PLANE_STUB_RIGHT_TOP];
const STUB_CELLS = 2;

export function restoreColumnFromSavedRun(m) {
  const { mem8 } = m;
  let source = CHAR_PLANE_BASE;
  for (let i = 0; i < COLUMN_CELLS; i++) mem8[CHAR_PLANE_COLUMN_BASE + i * ROW] = mem8[source++];
  for (const stub of STUB_COLUMNS) {
    for (let i = 0; i < STUB_CELLS; i++) mem8[stub + i * ROW] = mem8[source++];
  }
}
