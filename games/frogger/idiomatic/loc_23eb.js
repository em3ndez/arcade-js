// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23eb — advance the slot cursor mod-6 (wraps to 0 at 6).
 * LIVE-OUT: memory + register A (the new counter value).
 */
import { HOME_BAY_SLOT_CURSOR } from "./names.js";

const SLOT_CYCLE = 6;

export function loc_23eb(m) {
  const { regs, mem8 } = m;
  const next = (mem8[HOME_BAY_SLOT_CURSOR] + 1) & 0xff;
  const phase = next < SLOT_CYCLE ? next : 0;
  mem8[HOME_BAY_SLOT_CURSOR] = phase;
  regs.a = phase;
}
