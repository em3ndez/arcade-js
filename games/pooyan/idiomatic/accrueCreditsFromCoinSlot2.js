// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { addFullWrapCreditAmount } from "./addFullWrapCreditAmount.js";
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
import {
  INPUT_PORT0,
  DRIP_RING_B,
  COIN2_PULSE_COUNT,
  DRIP_COORD_B,
  COINAGE_CONFIG_SLOT2,
} from "./names.js";
/**
 * accrueCreditsFromCoinSlot2 — per-frame coin-slot-2 credit-accrual step.
 *
 * Each frame it rotates one input-port phase bit into the cadence ring. When the ring's low three
 * bits settle on the accept phase it emits the coin sound, bumps the pulse counter, and advances the first
 * coordinate by 0x10. While that coordinate has not overtaken the second it wraps the second
 * coordinate and joins the shared score-accumulate tail — the full-wrap entry (amount 0x63) or the
 * partial entry (amount = the second coord's low nibble).
 *
 * LIVE-OUT: memory only — the ring, the counter, the coordinate pair, and (on a fire) the score tail.
 */
const FIRE_PHASE = 0x01;
const RING_MASK = 0x07;
const COORD_STEP = 0x10;

export function accrueCreditsFromCoinSlot2(m) {
  const { mem8 } = m;

  const carry = (mem8[INPUT_PORT0] >> 1) & 1; // two rrca -> ring input is input-port bit1
  const ring = ((mem8[DRIP_RING_B] << 1) | carry) & 0xff; // rl (ring)
  mem8[DRIP_RING_B] = ring;
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: only the ring advanced

  emitPresetSound(m); // coin-accept sound
  mem8[COIN2_PULSE_COUNT] = u8(mem8[COIN2_PULSE_COUNT] + 1);

  const coord1 = u8(mem8[DRIP_COORD_B] + COORD_STEP);
  mem8[DRIP_COORD_B] = coord1;

  const coord2 = mem8[COINAGE_CONFIG_SLOT2]; // second coord of the pair (shares the slot-2 cell)
  if (coord2 >= coord1) return; // first has not overtaken the second

  const delta = u8((coord2 & 0xf0) + COORD_STEP);
  mem8[DRIP_COORD_B] = u8(u8(-delta) + coord1); // wrap the second coord back into the first

  const addend = coord2 & 0x0f;
  if (addend !== 0x0f) return addCreditsAndQueueDisplay(m, addend); // partial wrap
  return addFullWrapCreditAmount(m); // full wrap (tail seeds amount 0x63)
}
