// SPDX-License-Identifier: GPL-3.0-only
import {
  PALETTE_RECORD_TABLE,
  loc_1405, loc_1406, loc_1407, loc_140d, loc_140e, loc_140f,
} from "./names.js";

/**
 * loadPaletteRecordPair — read a 3-byte colour record indexed by X and fan it out into two
 * palette triples in a fixed permutation. For record [b0, b1, b2]:
 *   triple A = (b1, b2, b0)
 *   triple B = (b0, b2, b1)
 * X selects the record; the registers are scratch on exit. [code]
 *
 * @param {Machine} m
 * @param {number} [x=m.regs.x] record index
 */
export function loadPaletteRecordPair(m, x = m.regs.x) {
  const base = PALETTE_RECORD_TABLE + (x & 0xff);
  const b0 = m.mem8[base];
  const b1 = m.mem8[base + 1];
  const b2 = m.mem8[base + 2];

  m.mem8[loc_140e] = b2;
  m.mem8[loc_1406] = b2;
  m.mem8[loc_140f] = b0;
  m.mem8[loc_1405] = b0;
  m.mem8[loc_140d] = b1;
  m.mem8[loc_1407] = b1;
}
