// SPDX-License-Identifier: GPL-3.0-only
import { readEaromCell } from "./readEaromCell.js";
import { loc_0178, loc_f9 } from "./names.js";

/**
 * loadHighScoreTableFromEarom -- slurp the whole 64-byte high-score NVRAM into the
 * work-RAM mirror, then park the writeback cursor at "nothing pending".
 *
 * For X = 0x3f down to 0, read cell X and store it in the mirror. After the loop X
 * has wrapped to 0xff, and that 0xff becomes the cursor value -- meaning the writeback
 * ticker has no dirty slot to flush, since the mirror is fresh from the device.
 *
 * Live-out: the 64-byte RAM mirror, the cursor (== 0xff), and the device state the
 * cell read leaves (address latched to 0, data-out = cell 0). Registers A/X are dead.
 */
export function loadHighScoreTableFromEarom(m, a = m.regs.a) {
  const { mem8 } = m;
  for (let x = 0x3f; x >= 0; x--) {
    a = readEaromCell(m, a, x); // A = cells[X]; A_in is threaded but a don't-care (the read overwrites it)
    mem8[loc_0178 + x] = a;
  }
  mem8[loc_f9] = 0xff; // stx $f9 — X wrapped to 0xff: no writeback pending
}
