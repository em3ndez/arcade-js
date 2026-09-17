// SPDX-License-Identifier: GPL-3.0-only
/** loc_10f8 — give five display-list slots a second appearance, half a screen away.
 *
 * A slot is a pair of bytes and the high bit of the first one is a request. Where it is set the
 * pair trades half a byte range: the requester gives that half up and the partner takes it on,
 * which is what carries the slot into the far half of the display. A slot with no request is
 * stepped over, not stopped at, so a gap in the middle costs the slots after it nothing.
 * The hold that belongs before each trade is not reproduced; the same bytes land either way.
 * LIVE-OUT: memory only. */

import {
  SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X,
  SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X,
  SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X,
  SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X,
  SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X,
} from "./names.js";

const SPLIT_SLOTS = [
  { request: SPRITE_BANK1_SLOT19_Y, partner: SPRITE_BANK0_SLOT19_X },
  { request: SPRITE_BANK1_SLOT20_Y, partner: SPRITE_BANK0_SLOT20_X },
  { request: SPRITE_BANK1_SLOT21_Y, partner: SPRITE_BANK0_SLOT21_X },
  { request: SPRITE_BANK1_SLOT22_Y, partner: SPRITE_BANK0_SLOT22_X },
  { request: SPRITE_BANK1_SLOT23_Y, partner: SPRITE_BANK0_SLOT23_X },
];

const HALF_RANGE = 128;

export function loc_10f8(m) {
  const { mem8 } = m;
  for (const slot of SPLIT_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
  }
}
