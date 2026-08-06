// SPDX-License-Identifier: GPL-3.0-only
/** driftAtHalfWorldScroll — drift one object by half of a displacement that is not its own.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base,
 * the fraction off the other. Both gain the shared world displacement rather than anything read
 * off the object, halved on the way in, so this keeps half the pace of one that takes the whole
 * of it. The fraction carries into the whole, so a coordinate moves and wraps as one number.
 * LIVE-OUT: memory, four bytes; the second moved coordinate is also left standing. */

import { displaceByHalf } from "./displaceByHalf.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const ROW_REMAINDER = 3;
const COLUMN_REMAINDER = 5;
const SPRITE_ROW = 49;

export function driftAtHalfWorldScroll(m, object = m.regs.ix, sprite = m.regs.iy) {
  driftCoordinate(m, sprite + SPRITE_ROW, object + ROW_REMAINDER, m.mem16[WORLD_SCROLL_Y]);
  driftCoordinate(m, sprite, object + COLUMN_REMAINDER, m.mem16[WORLD_SCROLL_X]);
}

/** One coordinate: whole and fraction read as a single number, moved, then split back. */
function driftCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = displaceByHalf(m, displacement, (mem8[wholeAddr] << 8) + mem8[fractionAddr]);
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
