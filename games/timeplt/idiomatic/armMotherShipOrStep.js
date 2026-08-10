// SPDX-License-Identifier: GPL-3.0-only
/**
 * armMotherShipOrStep — the once-in-eight-frames gate for the Mother-Ship: while it is live, defer to
 * the stepper; else, once the kill quota is spent and both its two-slot-bank records are empty, arm it
 * (raise the armed flag, seed the seven-hit counter) and retire the entry pair to spawn it. LIVE-OUT: memory.
 */

import { retireEntryPairIntoCooldown } from "./retireEntryPairIntoCooldown.js";
import { ROUND_TRANSITION_HOLD } from "./names.js";

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

export function armMotherShipOrStep(m) {
  const { regs, mem8 } = m;

  if (mem8[ROUND_TRANSITION_HOLD] === HELD) return;

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
