// SPDX-License-Identifier: GPL-3.0-only
/** spinRemainingSpriteMultiplexSlots — a caller's tail into the five-slot display pass, entered inside the first slot.
 * The caller has already tested a byte it holds: a clear test steps over the first slot, else
 * that byte is the slot's request and trades from it once the raster is past the line — below
 * which the whole pass restarts and re-reads every slot. Slots two to five then trade wherever
 * their own top bit is set; the hold before each trade is dropped. LIVE-OUT: memory only. */

import { loc_10f8 } from "./loc_10f8.js";
import { SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X, loc_c000, SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X, SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X, SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X, SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X } from "./names.js";

const HALF_RANGE = 128;

const TAIL_SLOTS = [
  { request: SPRITE_BANK1_SLOT20_Y, partner: SPRITE_BANK0_SLOT20_X },
  { request: SPRITE_BANK1_SLOT21_Y, partner: SPRITE_BANK0_SLOT21_X },
  { request: SPRITE_BANK1_SLOT22_Y, partner: SPRITE_BANK0_SLOT22_X },
  { request: SPRITE_BANK1_SLOT23_Y, partner: SPRITE_BANK0_SLOT23_X },
];

export function spinRemainingSpriteMultiplexSlots(m) {
  const { regs, mem8 } = m;
  const held = regs.a;
  if (!regs.fZ) {
    if (((held + mem8[loc_c000]) & 0x100) === 0) return loc_10f8(m);
    mem8[SPRITE_BANK1_SLOT19_Y] = held & 0x7f;
    mem8[SPRITE_BANK0_SLOT19_X] = mem8[SPRITE_BANK0_SLOT19_X] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: SPRITE_BANK1_SLOT19_Y, x: SPRITE_BANK0_SLOT19_X }); // beam-sync render
  }
  for (const slot of TAIL_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: slot.request, x: slot.partner }); // beam-sync render
  }
}
