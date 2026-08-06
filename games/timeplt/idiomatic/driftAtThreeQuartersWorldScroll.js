// SPDX-License-Identifier: GPL-3.0-only
/** driftAtThreeQuartersWorldScroll — carry one object along with the scrolling world, at three quarters of the pace.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base, the
 * fraction off the other. Both are moved by a displacement read from a fixed pair of cells rather
 * than from the object, shortened by a quarter on the way in, so an object running this trails one
 * that takes the whole displacement. LIVE-OUT: memory only — four bytes, nothing clamped; the
 * second moved coordinate is also left standing in the pair the move hands it back through. */

import { displaceByThreeQuarters } from "./displaceByThreeQuarters.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

export function driftAtThreeQuartersWorldScroll(m) {
  const { regs } = m;
  const object = regs.ix;
  const sprite = regs.iy;

  moveCoordinate(m, sprite + 49, object + 3, m.mem16[WORLD_SCROLL_Y]);
  moveCoordinate(m, sprite, object + 5, m.mem16[WORLD_SCROLL_X]);
}

/** One coordinate: whole and fraction read as a single number, moved, then split back. */
function moveCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = displaceByThreeQuarters(m, displacement, (mem8[wholeAddr] << 8) + mem8[fractionAddr]);
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
