// SPDX-License-Identifier: GPL-3.0-only
/** spinRemainingSpriteMultiplexSlots — a caller's tail into the five-slot display pass, entered inside the first slot.
 * The caller has already tested a byte it holds: a clear test steps over the first slot, else
 * that byte is the slot's request and trades from it once the raster is past the line — below
 * which the whole pass restarts and re-reads every slot. Slots two to five then trade wherever
 * their own top bit is set; the hold before each trade is dropped. LIVE-OUT: memory only. */

import { loc_10f8 } from "./loc_10f8.js";
import { loc_b437, loc_b036, loc_c000, loc_b439, loc_b038, loc_b43b, loc_b03a, loc_b43d, loc_b03c, loc_b43f, loc_b03e } from "./names.js";

const HALF_RANGE = 128;

const TAIL_SLOTS = [
  { request: loc_b439, partner: loc_b038 },
  { request: loc_b43b, partner: loc_b03a },
  { request: loc_b43d, partner: loc_b03c },
  { request: loc_b43f, partner: loc_b03e },
];

export function spinRemainingSpriteMultiplexSlots(m) {
  const { regs, mem8 } = m;
  const held = regs.a;
  if (!regs.fZ) {
    if (((held + mem8[loc_c000]) & 0x100) === 0) return loc_10f8(m);
    mem8[loc_b437] = held & 0x7f;
    mem8[loc_b036] = mem8[loc_b036] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: loc_b437, x: loc_b036 }); // beam-sync render
  }
  for (const slot of TAIL_SLOTS) {
    const request = mem8[slot.request];
    if (request < HALF_RANGE) continue;
    mem8[slot.request] = request - HALF_RANGE;
    mem8[slot.partner] = mem8[slot.partner] + HALF_RANGE;
    if (m.beamPlan) m.beamPlan.push({ y: slot.request, x: slot.partner }); // beam-sync render
  }
}
