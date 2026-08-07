// SPDX-License-Identifier: GPL-3.0-only
/** flyAlongHeadingAtDoubleVelocity — fly one object a DOUBLE step along the heading it holds, while the world scrolls
 * underneath it. The heading picks a pair of perpendicular components out of the speed table the
 * caller chose; each of the object's two coordinates then gains TWICE its own component plus the
 * per-frame displacement every object shares, which is added once rather than twice — so doubling
 * moves the object faster through the world without moving the world. Each coordinate is 16 bits
 * stored split, the whole part in the sprite entry and the fraction in the record, so a component
 * smaller than half a pixel still banks. LIVE-OUT: memory only — the four coordinate bytes. */

import { velocityForHeading } from "./velocityForHeading.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const CURRENT_HEADING = 2;
const FIRST_AXIS_WHOLE = 49;
const FIRST_AXIS_FRACTION = 3;
const SECOND_AXIS_WHOLE = 0;
const SECOND_AXIS_FRACTION = 5;

export function flyAlongHeadingAtDoubleVelocity(m, table = m.regs.hl) {
  const object = m.regs.ix;
  const sprite = m.regs.iy;

  velocityForHeading(m, table, m.mem8[object + CURRENT_HEADING]);
  const alongFirstAxis = m.regs.de;
  const alongSecondAxis = m.regs.bc;

  advanceCoordinate(
    m,
    sprite + FIRST_AXIS_WHOLE,
    object + FIRST_AXIS_FRACTION,
    m.mem16[WORLD_SCROLL_Y] + 2 * alongFirstAxis,
  );
  advanceCoordinate(
    m,
    sprite + SECOND_AXIS_WHOLE,
    object + SECOND_AXIS_FRACTION,
    m.mem16[WORLD_SCROLL_X] + 2 * alongSecondAxis,
  );
}

/** One coordinate: whole and fraction read as a single number, displaced, then split back. */
function advanceCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = (mem8[wholeAddr] << 8) + mem8[fractionAddr] + displacement;
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
