// SPDX-License-Identifier: GPL-3.0-only
/** tileCharPlaneWithBoxLattice — tile the character plane with a lattice of boxes: fourteen bands
 * of sixteen, each box two cells wide and two lines deep, every one of them laid down by
 * stampGridBox.
 *
 * ROLE. A power-on pattern. Under MAME this routine runs exactly once, at frame 33 in sequence
 * phase 0; the lattice stands on the glass from frame 35, and the boot wipe of the plane removes it
 * before the attract loop begins -- nothing is drawn on top of it. The character plane (from
 * CHAR_PLANE_BASE, 0xA400) is 32 cells per native row, and each box covers two cells of one row and
 * the two below them. The cursor starts one row into the plane (0xA420) and skips a row before each
 * band, so the lattice begins clear of the top rows. A band's sixteen two-cell steps advance the
 * cursor by exactly one row, onto the band's own second row, and the next skip moves past that, so
 * the bands come out contiguous. Every position is counted out here; nothing is read to decide
 * where a box goes. MAME measures 224 boxes of four writes, 896 distinct cells spanning
 * 0xA440-0xA7BF: 28 of the plane's 32 rows across all 32 columns.
 *
 * ROM 0x00B1-0x00C6 (frozen lift translated/loc_00b1.js). Grounding: [seen] (names.js ROUTINES
 * 0x00b1). LIVE-OUT: the lattice in memory only.
 */

import { stampGridBox } from "./stampGridBox.js";
import { CHAR_PLANE_BASE } from "./names.js";

// One native row of the character plane; the cursor starts one row in (ROM `ld hl,0xa420`).
const CELLS_PER_LINE = 32;
const CURSOR_ORIGIN = CHAR_PLANE_BASE + CELLS_PER_LINE;
// Outer count (ROM C = 0x0E) and inner count (ROM B = 0x10), and the stride between boxes.
const BANDS = 14;
const BOXES_PER_BAND = 16;
const BOX_CELLS = 2;

export function tileCharPlaneWithBoxLattice(m) {
  let cursor = CURSOR_ORIGIN;
  for (let band = 0; band < BANDS; band++) {
    // Skip a row (`ld de,0x0020 / add hl,de`): the band's boxes go into the row after it
    // and, two rows deep, into the row below that.
    cursor += CELLS_PER_LINE;
    for (let box = 0; box < BOXES_PER_BAND; box++) {
      // `call 0x00c7`: stampGridBox lays the box's four corner tiles and hands the cursor back
      // unmoved; this loop then steps two cells (`inc hl / inc hl`) to the next box.
      stampGridBox(m, cursor);
      cursor += BOX_CELLS;
    }
  }
}
