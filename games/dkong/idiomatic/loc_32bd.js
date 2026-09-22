// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32bd — a three-way object-walker dispatch keyed on the current board: board 1 -> the
 * flat-table walker, board 2 -> its direction-selected twin, anything else -> the two-table
 * record seeder.
 *
 * LIVE-OUT: memory-only — whatever the chosen handler writes into the object record.
 */

import { BOARD } from "./names.js";
import { loc_342c } from "./loc_342c.js";
import { loc_3478 } from "./loc_3478.js";
import { loc_34b9 } from "./loc_34b9.js";

export function loc_32bd(m, ix = m.regs.ix) {
  const board = m.mem8[BOARD];

  if (board === 0x01) {
    loc_342c(m, ix);
    return;
  }
  if (board === 0x02) {
    loc_3478(m, ix);
    return;
  }
  loc_34b9(m, ix);
}
