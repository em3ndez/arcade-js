// SPDX-License-Identifier: GPL-3.0-only
/** driftAtHalfWorldScroll — drift one object by half of a displacement that is not its own.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base,
 * the fraction off the other. Both gain a displacement read from a fixed pair of cells rather
 * than from the object — so every object that runs this drifts alike — and each displacement is
 * halved on the way in, so the object keeps half the pace of one that takes the whole of it.
 * The fraction carries into the whole, so a coordinate moves and wraps as one number.
 * LIVE-OUT: memory, four bytes; the second moved coordinate is also left standing. */

import { displaceByHalf } from "./displaceByHalf.js";

const ROW_DISPLACEMENT = 0xa808;
const COLUMN_DISPLACEMENT = 0xa80a;
const ROW_REMAINDER = 3;
const COLUMN_REMAINDER = 5;
const SPRITE_ROW = 49;

export function driftAtHalfWorldScroll(m, object = m.regs.ix, sprite = m.regs.iy) {
  driftCoordinate(m, sprite + SPRITE_ROW, object + ROW_REMAINDER, m.mem16[ROW_DISPLACEMENT]);
  driftCoordinate(m, sprite, object + COLUMN_REMAINDER, m.mem16[COLUMN_DISPLACEMENT]);
}

/** One coordinate: whole and fraction read as a single number, moved, then split back. */
function driftCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = displaceByHalf(m, displacement, (mem8[wholeAddr] << 8) + mem8[fractionAddr]);
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
