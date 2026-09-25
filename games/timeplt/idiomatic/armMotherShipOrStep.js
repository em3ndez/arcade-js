// SPDX-License-Identifier: GPL-3.0-only
/**
 * armMotherShipOrStep — the once-in-eight-frames gate for the Mother-Ship: while it is live, defer to
 * the stepper; else, once the kill quota is spent and both its two-slot-bank records are empty, arm it
 * (raise the armed flag, seed the seven-hit counter) and retire the entry pair to spawn it. LIVE-OUT: memory.
 */

import { retireEntryPairIntoCooldown } from "./retireEntryPairIntoCooldown.js";
import { stepMotherShip } from "./stepMotherShip.js";
import {
  FRAME_TICK,
  KILLS_REMAINING,
  MOTHER_SHIP_ARMED,
  MOTHER_SHIP_ENTRY,
  MOTHER_SHIP_STATE,
  ROUND_TRANSITION_HOLD,
} from "./names.js";

const RECORD_STRIDE = 0x10;
const HELD = 0xff;
const PHASE_MASK = 0x07;
const PHASE_DUE = 0x05;
const FIRE_BYTE = 0x04;
const FIRE_ARMED = 0x07;

export function armMotherShipOrStep(m) {
  const { regs, mem8 } = m;

  if (mem8[ROUND_TRANSITION_HOLD] === HELD) return;

  if (mem8[MOTHER_SHIP_ARMED] !== 0) return stepMotherShip(m);

  if ((mem8[FRAME_TICK] & PHASE_MASK) !== PHASE_DUE) return;

  if ((mem8[KILLS_REMAINING] | mem8[MOTHER_SHIP_STATE] | mem8[MOTHER_SHIP_STATE + RECORD_STRIDE]) !== 0) {
    return void (regs.ix = MOTHER_SHIP_STATE, regs.iy = MOTHER_SHIP_ENTRY);
  }

  mem8[MOTHER_SHIP_ARMED] = HELD;
  mem8[MOTHER_SHIP_STATE + FIRE_BYTE] = FIRE_ARMED;
  return (regs.ix = MOTHER_SHIP_STATE, regs.iy = MOTHER_SHIP_ENTRY, retireEntryPairIntoCooldown(m));
}
