// SPDX-License-Identifier: GPL-3.0-only
/** loc_28e3 — put one object record, and the sprite entry that shows it, in front of the era-keyed
 * per-slot handler. Choosing that pair is the whole of what this entry decides; the handler is
 * reached as a transfer, so it returns past here and nothing here runs after it.
 * LIVE-OUT: memory, and whatever the handler leaves behind. */

import { loc_290e } from "./loc_290e.js";

const CRAFT_RECORD = 0xa890;
const SPRITE_ENTRY = 0xaa22;

export function loc_28e3(m) {
  m.regs.ix = CRAFT_RECORD;
  m.regs.iy = SPRITE_ENTRY;
  return loc_290e(m);
}
