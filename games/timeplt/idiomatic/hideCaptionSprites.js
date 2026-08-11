// SPDX-License-Identifier: GPL-3.0-only
/** hideCaptionSprites — clear one byte in each of four slots, evenly spaced two apart from a fixed first
 * one. The run is chosen here and a caller cannot redirect it; whatever those four bytes held is
 * discarded unread, so this clears rather than steps. LIVE-OUT: those four bytes. */

import { PLAYER_SPRITE_Y } from "./names.js";
const SLOT_STRIDE = 2;
const SLOTS = 4;

export function hideCaptionSprites(m) {
  const { mem8 } = m;
  for (let i = 0; i < SLOTS; i++) mem8[PLAYER_SPRITE_Y + i * SLOT_STRIDE] = 0;
}
