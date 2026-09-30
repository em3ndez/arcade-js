// SPDX-License-Identifier: GPL-3.0-only
/** blankNextLine — blank one line of the character plane and move the eraser on to the next line.
 *
 * A cursor cell says where the line starts. Thirty-two cells are walked from there, each given
 * the blanking glyph and, in the plane beside it, one fixed colour. Coming back from that plane
 * is a SET rather than a restore, so a cursor arriving on the colour side has its first cell
 * blanked there and is then snapped across for the rest of the line. The cursor is re-read
 * afterwards and advanced by ONE — the next line, not the next cell — and a counter of lines
 * still to erase is taken down by one.
 *
 * ROM 0x01C2-0x01E0 (frozen lift translated/loc_01c2.js). Grounding: [seen] -- a read tap at this
 * entry on the real ROM under MAME counted exactly 32 dispatches through the boot wipe, in two
 * independent runs; 32 is the tilemap's line count (names.js).
 *
 * Role in the machine: the per-frame worker of the character-plane wipe. A wipe is started by
 * seating BLANK_LINE_CURSOR (0xA989) and BLANK_LINES_LEFT (0xA988) -- e.g. the boot arm seats the
 * cursor at 0xA400 with a count of 32, which is the whole 0xA400-0xA7FF plane. Its callers,
 * armAttractScreenShowingHighScore and blankOneLineThenGuardBlockOrDerailSequence, return early
 * while the count is non-zero, so one line is blanked per call and the wipe spans frames instead
 * of running to completion inside one. The ROM hands that zero test back in the flags (`dec (hl)`);
 * here it is the returned boolean.
 *
 * LIVE-OUT: the cells, the cursor, the counter, and whether that counter has reached zero,
 * returned. */

import { u8, u16 } from "../../../core/int.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR } from "./names.js";

// A line is 32 cells (ROM `ld b,0x20`), walked 32 addresses apart (`ld de,0x0020`).
const CELLS_PER_LINE = 32;
const CELL_STEP = 32;
// The blanking glyph (`ld (hl),0xf1`) and the one colour every blanked cell gets (`ld (hl),0x10`).
const BLANK_GLYPH = 241;
const LINE_COLOUR = 16;
// Bit 10 of a cell address: set = character plane (0xA400-0xA7FF), clear = colour plane.
const CHARACTER_PLANE_BIT = 0x400;

export function blankNextLine(m) {
  const { mem8, mem16 } = m;
  let cursor = mem16[BLANK_LINE_CURSOR];
  /* Walk the line. Each cell: write the glyph at the cursor, clear bit 10 (`res 2,h`) to reach the
   * same cell's colour byte and write the colour, then SET bit 10 (`set 2,h`) and step 32. Because
   * the return is a set, not a toggle back, the walk is on the character plane from the second
   * cell onward whatever plane the cursor started in. */
  for (let cell = 0; cell < CELLS_PER_LINE; cell++) {
    mem8[cursor] = BLANK_GLYPH;
    mem8[cursor & ~CHARACTER_PLANE_BIT] = LINE_COLOUR;
    cursor = u16((cursor | CHARACTER_PLANE_BIT) + CELL_STEP);
  }
  /* Advance the wipe. The ROM re-reads the cursor from memory rather than using the walked one and
   * adds ONE (`inc hl`): a line is walked across rows 32 apart, so the next line starts at the very
   * next cell of the first row. */
  mem16[BLANK_LINE_CURSOR] = u16(mem16[BLANK_LINE_CURSOR] + 1);
  /* Count one line off (`dec (hl)` on 0xA988, wrapping at eight bits) and report whether the wipe
   * is finished -- the Z flag the callers test. */
  const left = u8(mem8[BLANK_LINES_LEFT] - 1);
  mem8[BLANK_LINES_LEFT] = left;
  return left === 0;
}
