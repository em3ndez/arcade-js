// SPDX-License-Identifier: GPL-3.0-only
/** driftAtFiveQuartersWorldScroll — carry one object along with the scrolling world, over-travelling it by a quarter.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base, the
 * fraction off the other. Both gain a displacement read from a fixed pair of cells rather than
 * from the object — so every object running this drifts alike — lengthened by a quarter of
 * itself before it lands, which carries the object further than those cells hold.
 * LIVE-OUT: memory only — four bytes; nothing is clamped and nothing is returned. */

import { displaceByFiveQuarters } from "./displaceByFiveQuarters.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

export function driftAtFiveQuartersWorldScroll(m) {
  const { regs } = m;
  const object = regs.ix;
  const sprite = regs.iy;

  driftCoordinate(m, sprite + 49, object + 3, m.mem16[WORLD_SCROLL_Y]);
  driftCoordinate(m, sprite, object + 5, m.mem16[WORLD_SCROLL_X]);
}

/** One coordinate: whole and fraction read as a single number, displaced, then split back. */
function driftCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = displaceByFiveQuarters(m, displacement, (mem8[wholeAddr] << 8) + mem8[fractionAddr]);
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
