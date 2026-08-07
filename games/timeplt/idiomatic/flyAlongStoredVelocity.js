// SPDX-License-Identifier: GPL-3.0-only
/** flyAlongStoredVelocity — fly one object a single step along the velocity it CARRIES, and in the same add
 * carry it with the world.
 *
 * Each of the object's two coordinates is sixteen bits stored split: the whole part in the
 * sprite entry, the fraction in the record, so a step smaller than a pixel banks instead of
 * vanishing. Each coordinate gains its own velocity word — read out of the object's own record
 * rather than looked up from a heading — PLUS a per-frame displacement held in a fixed pair of
 * cells that every object shares. The two are folded into one add, which is why nothing else may
 * drift this object: a separate drift beside this would apply that shared displacement twice.
 * LIVE-OUT: memory only — the four coordinate bytes; nothing is clamped and nothing returned. */

import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const VELOCITY_HIGH_AXIS = 10;
const VELOCITY_LOW_AXIS = 12;
const FRACTION_HIGH_AXIS = 3;
const FRACTION_LOW_AXIS = 5;
const WHOLE_HIGH_AXIS = 49;
const WHOLE_LOW_AXIS = 0;

export function flyAlongStoredVelocity(m) {
  const object = m.regs.ix;
  const sprite = m.regs.iy;

  advanceCoordinate(
    m, sprite + WHOLE_HIGH_AXIS, object + FRACTION_HIGH_AXIS,
    m.mem16[object + VELOCITY_HIGH_AXIS] + m.mem16[WORLD_SCROLL_Y],
  );
  advanceCoordinate(
    m, sprite + WHOLE_LOW_AXIS, object + FRACTION_LOW_AXIS,
    m.mem16[object + VELOCITY_LOW_AXIS] + m.mem16[WORLD_SCROLL_X],
  );
}

/** One coordinate: whole and fraction read as a single number, displaced, then split back. */
function advanceCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = (mem8[wholeAddr] << 8) + mem8[fractionAddr] + displacement;
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
