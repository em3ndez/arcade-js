// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearAndSeedScoreField — reset the score field for a new board: clear the active player's work RAM,
 * zero the score-display cursor pair, mark the field seeded, then tile the field with the blank marker:
 * 0x20 rows, two ten-cell runs per row separated by a two-cell gap, stepping down one row per pass.
 * LIVE-OUT: memory-only.
 */
import { loc_839a, loc_839b, loc_83cc } from "./names.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { fillTenCellRun } from "./fillTenCellRun.js";

const FIELD_BASE = 0xa806;
const ROWS = 0x20;
const RUN = 10;
const GAP = 2;
const ROW_STEP = 0x0a;

export function clearAndSeedScoreField(m) {
  const { mem8 } = m;

  clearActivePlayerWorkRam(m);

  mem8[loc_839a] = 0;
  mem8[loc_839b] = 0;
  mem8[loc_83cc] = 1;

  let p = FIELD_BASE;
  for (let row = ROWS; row !== 0; row = (row - 1) & 0xff) {
    fillTenCellRun(m, p);
    p = (p + RUN) & 0xffff;
    p = (p & 0xff00) | ((p + GAP) & 0xff); // step the low byte only, no carry into the page
    fillTenCellRun(m, p);
    p = (p + RUN) & 0xffff;
    p = (p + ROW_STEP) & 0xffff;
  }
}
