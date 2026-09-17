// SPDX-License-Identifier: GPL-3.0-only
/** tileCharPlaneWithBoxLattice — tile the character plane with a lattice of boxes: fourteen bands of sixteen, each
 * box two cells wide and two lines deep, laid down by the stamp this hands the cursor to. The
 * cursor starts one line into the plane and skips a line before each band, so the lattice begins
 * clear of the top lines and the bands it writes are contiguous. Every position is counted out
 * here; nothing is read to decide where a box goes.
 * LIVE-OUT: the lattice in memory; and the register state the counted walk unwinds to — the cursor
 * left one line past the last band, the band and box counters run down to zero, and a flag byte the
 * final counter-decrement-to-zero leaves with zero and subtract set and carry clear. The step the
 * stamp carries in the address pair rides out from its last call. */

import { stampGridBox } from "./stampGridBox.js";
import { CHAR_PLANE_BASE } from "./names.js";

const CELLS_PER_LINE = 32;
const CURSOR_ORIGIN = CHAR_PLANE_BASE + CELLS_PER_LINE;
const BANDS = 14;
const BOXES_PER_BAND = 16;
const BOX_CELLS = 2;

const COUNTER_EMPTY_FLAGS = 0x42; // Z set, N (subtract) set, carry clear: the last band-counter dec to zero

export function tileCharPlaneWithBoxLattice(m) {
  let cursor = CURSOR_ORIGIN;
  for (let band = 0; band < BANDS; band++) {
    cursor += CELLS_PER_LINE;
    for (let box = 0; box < BOXES_PER_BAND; box++) {
      stampGridBox(m, cursor);
      cursor += BOX_CELLS;
    }
  }
  // The counted walk leaves the cursor past the last band and both counters spent; the step the
  // stamp hands back in the address pair is already seated by its final call.
  return (m.regs.hl = cursor), (m.regs.b = 0), (m.regs.c = 0), (m.regs.f = COUNTER_EMPTY_FLAGS);
}
