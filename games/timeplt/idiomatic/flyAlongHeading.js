// SPDX-License-Identifier: GPL-3.0-only
/** flyAlongHeading — fly one object a single step along the heading it holds, while the world scrolls
 * underneath it. That heading picks a pair of perpendicular components out of the speed
 * table the caller chose; each of the object's two coordinates then gains its own component PLUS
 * a per-frame displacement held in a fixed pair of cells, shared by every object rather than read
 * off this one. Each coordinate is 16 bits stored split: the whole part in the sprite entry, the
 * fraction in the record, so a component smaller than a pixel banks instead of vanishing.
 * LIVE-OUT: memory only — the four coordinate bytes; nothing is clamped and nothing is returned. */

import { velocityForHeading } from "./velocityForHeading.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const CURRENT_HEADING = 2;

export function flyAlongHeading(m, table = m.regs.hl) {
  const object = m.regs.ix;
  const sprite = m.regs.iy;

  velocityForHeading(m, table, m.mem8[object + CURRENT_HEADING]);
  const alongFirstAxis = m.regs.de;
  const alongSecondAxis = m.regs.bc;

  advanceCoordinate(m, sprite + 49, object + 3, m.mem16[WORLD_SCROLL_Y] + alongFirstAxis);
  advanceCoordinate(m, sprite, object + 5, m.mem16[WORLD_SCROLL_X] + alongSecondAxis);
}

/** One coordinate: whole and fraction read as a single number, displaced, then split back. */
function advanceCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = (mem8[wholeAddr] << 8) + mem8[fractionAddr] + displacement;
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
