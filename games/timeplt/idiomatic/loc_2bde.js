// SPDX-License-Identifier: GPL-3.0-only
/** loc_2bde — take an object out of play. Five unconditional zero stores and no
 * reads: the slot byte that marks it occupied, the two sub-pixel remainders carrying
 * its motion, and both coordinates of its sprite entry. LIVE-OUT: memory-only. */

const ROW_REMAINDER = 3;
const COLUMN_REMAINDER = 5;
/** A sprite entry's two coordinates sit this far apart, in parallel tables. */
const SPRITE_ROW = 49;

export function loc_2bde(m, slot = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  mem8[slot] = 0;
  mem8[slot + ROW_REMAINDER] = 0;
  mem8[slot + COLUMN_REMAINDER] = 0;
  mem8[sprite] = 0;
  mem8[sprite + SPRITE_ROW] = 0;
}
