// SPDX-License-Identifier: GPL-3.0-only
/** tileCharPlaneWithBoxLattice — tile the character plane with a lattice of boxes: fourteen bands of sixteen, each
 * box two cells wide and two lines deep, laid down by the stamp this hands the cursor to. The
 * cursor starts one line above the first band written and skips a line before each one, so the
 * lattice begins clear of the top lines and the bands it writes are contiguous. Every position is
 * counted out here; nothing is read to decide where a box goes. LIVE-OUT: memory only. */

import { stampGridBox } from "./stampGridBox.js";

const CURSOR_ORIGIN = 0xa420;
const CELLS_PER_LINE = 32;
const BANDS = 14;
const BOXES_PER_BAND = 16;
const BOX_CELLS = 2;

export function tileCharPlaneWithBoxLattice(m) {
  let cursor = CURSOR_ORIGIN;
  for (let band = 0; band < BANDS; band++) {
    cursor += CELLS_PER_LINE;
    for (let box = 0; box < BOXES_PER_BAND; box++) {
      stampGridBox(m, cursor);
      cursor += BOX_CELLS;
    }
  }
}
