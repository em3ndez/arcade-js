// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_283, loc_2c3, loc_2e3, loc_303, loc_323, loc_343, loc_363 } from "./names.js";
import { loc_a75d } from "./loc_a75d.js";

// Step a slot's three axis velocities one increment toward zero; when all three
// saturate, clear the slot's whole coordinate.
export function loc_a721(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = 0xfd; // seed the saturation counter
  // Each axis: step (low, whole) and store both back.
  {
    const [low, whole] = loc_a75d(m, mem8[u16(loc_2c3 + x)], mem8[u16(loc_323 + x)]);
    mem8[u16(loc_2c3 + x)] = low;
    mem8[u16(loc_323 + x)] = whole;
  }
  {
    const [low, whole] = loc_a75d(m, mem8[u16(loc_2e3 + x)], mem8[u16(loc_343 + x)]);
    mem8[u16(loc_2e3 + x)] = low;
    mem8[u16(loc_343 + x)] = whole;
  }
  {
    const [low, whole] = loc_a75d(m, mem8[u16(loc_303 + x)], mem8[u16(loc_363 + x)]);
    mem8[u16(loc_303 + x)] = low;
    mem8[u16(loc_363 + x)] = whole;
  }
  // Counter reaches zero only when every axis saturated.
  if (mem8[loc_29] !== 0) return;
  mem8[u16(loc_283 + x)] = 0x00;
}
