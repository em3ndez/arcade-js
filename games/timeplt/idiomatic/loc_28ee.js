// SPDX-License-Identifier: GPL-3.0-only
/** loc_28ee — put one object record, and the sprite entry that shows it, in front of the era-keyed
 * per-slot handler, unless the Mother-Ship is up: while it is nothing here runs at all. The handler
 * is reached as a transfer, so it returns past here and nothing here runs after it.
 * LIVE-OUT: memory, and whatever the handler leaves behind. */

import { loc_290e } from "./loc_290e.js";
import { MOTHER_SHIP_ARMED, MOTHER_SHIP_STATE } from "./names.js";

const SPRITE_ENTRY = 0xaa24;

export function loc_28ee(m) {
  if (m.mem8[MOTHER_SHIP_ARMED] !== 0) return;
  m.regs.ix = MOTHER_SHIP_STATE;
  m.regs.iy = SPRITE_ENTRY;
  return loc_290e(m);
}
