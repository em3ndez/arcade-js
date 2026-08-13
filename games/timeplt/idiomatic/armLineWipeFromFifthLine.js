// SPDX-License-Identifier: GPL-3.0-only
/** armLineWipeFromFifthLine — stage where a line wipe starts and how many lines it has left to run.
 * The start cell is an immediate; the count is fetched from a fixed cell of the program image
 * instead of being carried as one, so an edit to the image moves it. Neither staged cell is
 * read here, and nothing a caller was holding survives into either. LIVE-OUT: memory-only. */

import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR, BLANK_LINES_COUNT, BLANK_LINE_START_CELL } from "./names.js";

export function armLineWipeFromFifthLine(m) {
  const { mem8, mem16 } = m;
  mem16[BLANK_LINE_CURSOR] = BLANK_LINE_START_CELL;
  mem8[BLANK_LINES_LEFT] = mem8[BLANK_LINES_COUNT];
}
