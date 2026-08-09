// SPDX-License-Identifier: GPL-3.0-only
/** spinRemainingSpriteMultiplexSlots — a caller's tail into the five-slot display pass, entered inside the first slot.
 * The caller has already tested a byte it holds: a clear test steps over the first slot, else
 * that byte is the slot's request and trades from it once the raster is past the line — below
 * which the whole pass restarts and re-reads every slot. Slots two to five then trade wherever
 * their own top bit is set; the hold before each trade is dropped. LIVE-OUT: memory only. */

import { loc_10f8 } from "./loc_10f8.js";

const FIRST_REQUEST = 0xb437;
const FIRST_PARTNER = 0xb036;
const RASTER = 0xc000;
const HALF_RANGE = 128;

const TAIL_SLOTS = [
  { request: 0xb439, partner: 0xb038 },
  { request: 0xb43b, partner: 0xb03a },
  { request: 0xb43d, partner: 0xb03c },
  { request: 0xb43f, partner: 0xb03e },
];

export function spinRemainingSpriteMultiplexSlots(m) {
  const { regs, mem8 } = m;
  const held = regs.a;
  if (!regs.fZ) {
    if (((held + mem8[RASTER]) & 0x100) === 0) return loc_10f8(m);
    mem8[FIRST_REQUEST] = held & 0x7f;
    mem8[FIRST_PARTNER] = mem8[FIRST_PARTNER] + HALF_RANGE;
  }
  for (const slot of TAIL_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
  }
}
