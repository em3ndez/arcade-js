// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlots — give eight display-list slots a second appearance half a screen away: where
 * a slot's request bit (high bit of its first byte) is set, the pair trades half a byte range so the
 * slot moves to the far half; a slot with no request is untouched. Each relocation is recorded in
 * m.beamPlan so the beam-sync render can repaint the first appearance in its band. LIVE-OUT: memory, m.beamPlan. */

import {
  SPRITE_BANK1_SLOT0_Y, SPRITE_BANK0_BASE,
  SPRITE_BANK1_SLOT1_Y, SPRITE_BANK0_SLOT1_X,
  SPRITE_BANK1_SLOT2_Y, SPRITE_BANK0_SLOT2_X,
  SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X,
  SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X,
  SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X,
  SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X,
  SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X,
} from "./names.js";

const SPLIT_SLOTS = [
  { request: SPRITE_BANK1_SLOT0_Y, partner: SPRITE_BANK0_BASE },
  { request: SPRITE_BANK1_SLOT1_Y, partner: SPRITE_BANK0_SLOT1_X },
  { request: SPRITE_BANK1_SLOT2_Y, partner: SPRITE_BANK0_SLOT2_X },
  { request: SPRITE_BANK1_SLOT19_Y, partner: SPRITE_BANK0_SLOT19_X },
  { request: SPRITE_BANK1_SLOT20_Y, partner: SPRITE_BANK0_SLOT20_X },
  { request: SPRITE_BANK1_SLOT21_Y, partner: SPRITE_BANK0_SLOT21_X },
  { request: SPRITE_BANK1_SLOT22_Y, partner: SPRITE_BANK0_SLOT22_X },
  { request: SPRITE_BANK1_SLOT23_Y, partner: SPRITE_BANK0_SLOT23_X },
];

const HALF_RANGE = 128;

export function multiplexSpriteSlots(m) {
  const { mem8 } = m;
  for (const slot of SPLIT_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: slot.request, x: slot.partner });
  }
}
