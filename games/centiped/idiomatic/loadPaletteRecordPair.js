// SPDX-License-Identifier: GPL-3.0-only
import {
  PALETTE_RECORD_TABLE,
  PALETTE_COLOR_05, PALETTE_COLOR_06, PALETTE_COLOR_07, PALETTE_COLOR_0D, PALETTE_COLOR_0E, PALETTE_COLOR_0F,
} from "./names.js";

/**
 * loadPaletteRecordPair — read a 3-byte colour record indexed by X and fan it out into two
 * palette triples in a fixed permutation. For record [b0, b1, b2]:
 *   triple A = (b0, b2, b1)
 *   triple B = (b1, b2, b0)
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

  m.mem8[PALETTE_COLOR_0E] = b2;
  m.mem8[PALETTE_COLOR_06] = b2;
  m.mem8[PALETTE_COLOR_0F] = b0;
  m.mem8[PALETTE_COLOR_05] = b0;
  m.mem8[PALETTE_COLOR_0D] = b1;
  m.mem8[PALETTE_COLOR_07] = b1;
}
