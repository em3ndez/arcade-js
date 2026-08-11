// SPDX-License-Identifier: GPL-3.0-only
/** hideAllSprites — sweep every sprite off the picture at once. Every slot the display
 * scans carries a vertical position, and this zeros all of them; zero puts a slot above the
 * FIRST drawn line, clear of the picture entirely, so nothing of it appears. Every other byte of a slot stands, so none is
 * retired. LIVE-OUT: memory only — 24 bytes, evenly spaced and all inside one page. */

import { PLAYER_SPRITE_Y } from "./names.js";
const SLOT_COUNT = 24;
const SLOT_STRIDE = 2;

export function hideAllSprites(m) {
  const { mem8 } = m;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    mem8[PLAYER_SPRITE_Y + slot * SLOT_STRIDE] = 0;
  }
}
