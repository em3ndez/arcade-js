// SPDX-License-Identifier: GPL-3.0-only
/**
 * armLineWipeFromFifthLine — arm the character-plane wipe to start at the plane's fifth cell and
 * to run for a count taken from a fixed cell of the program image.
 *
 * ROM 0x01B5-0x01C1 (loc_01b5). Grounding: [seen] (names.js ROUTINES 0x01B5).
 *
 * What it is: clearing text off the screen is spread over frames. A wipe is described by two
 * cells — BLANK_LINE_CURSOR (0xA989) [seen], where the next line starts, and BLANK_LINES_LEFT
 * (0xA988) [seen], how many lines are still to blank — and blankNextLine blanks one line per
 * dispatch while its callers return early as long as the count survives. A "line" here runs
 * through the plane in steps of thirty-two cells, and the next line starts at the neighbouring
 * cell of the first, so a cursor at the plane's fifth cell (0xA404) skips the first four lines.
 *
 * This only ARMS the wipe: it writes the two cells and blanks nothing itself. Neither staged cell
 * is read here, and nothing a caller was holding survives into either.
 *
 * Role in the machine: it fires on the credit and game-over transitions and never in undriven
 * attract. Under MAME each dispatch of this entry was followed by exactly 27 dispatches of
 * blankNextLine, and the two cells read back in that frame held the fifth cell and 27. Its
 * whole-plane sibling (armWholePlaneWipeThenDerailOnATamperedImage) starts at the first cell with
 * an immediate 32.
 *
 * LIVE-OUT: memory only — the two wipe cells.
 */

import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR, BLANK_LINES_COUNT, BLANK_LINE_START_CELL } from "./names.js";

export function armLineWipeFromFifthLine(m) {
  const { mem8, mem16 } = m;
  // Seat the cursor on the plane's fifth cell: `ld hl,0xa404 / ld (0xa989),hl`, an immediate
  // written as one 16-bit word.
  mem16[BLANK_LINE_CURSOR] = BLANK_LINE_START_CELL;
  // Load the line count: `ld a,(0x0ccd) / ld (0xa988),a`. The count is NOT an immediate — it is
  // fetched from ROM byte 0x0CCD, so an edit to the program image changes how far the wipe runs.
  mem8[BLANK_LINES_LEFT] = mem8[BLANK_LINES_COUNT];
}
