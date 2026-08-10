// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_43b7 — the once-in-eight-frames gate for the era's special object. While the wave-hold flag is
 * clear it either defers to the stepper when a special is already live, or — only when both records of
 * the special's two-slot bank read empty — marks the special active, arms the lead record's fire byte
 * and retires the matching entry pair into cooldown. LIVE-OUT: memory (and a tail).
 */

import { retireEntryPairIntoCooldown } from "./retireEntryPairIntoCooldown.js";

const WAVE_HOLD = 0xacc6;
const SPECIAL_ACTIVE = 0xad0d;
const FRAME_TICK = 0xa980;
const SPAWN_GATE = 0xad02;
const RECORD = 0xa8a0;
const RECORD_STRIDE = 0x10;
const ENTRY = 0xaa24;
const HELD = 0xff;
const PHASE_MASK = 0x07;
const PHASE_DUE = 0x05;
const FIRE_BYTE = 0x04;
const FIRE_ARMED = 0x07;

export function loc_43b7(m) {
  const { regs, mem8 } = m;

  if (mem8[WAVE_HOLD] === HELD) return;

  regs.a = mem8[SPECIAL_ACTIVE];
  if (regs.a !== 0) return m.call(0x43f0);

  if ((mem8[FRAME_TICK] & PHASE_MASK) !== PHASE_DUE) return;

  regs.ix = RECORD;
  regs.iy = ENTRY;
  if ((mem8[SPAWN_GATE] | mem8[RECORD] | mem8[RECORD + RECORD_STRIDE]) !== 0) return;

  mem8[SPECIAL_ACTIVE] = HELD;
  mem8[RECORD + FIRE_BYTE] = FIRE_ARMED;
  return retireEntryPairIntoCooldown(m);
}
