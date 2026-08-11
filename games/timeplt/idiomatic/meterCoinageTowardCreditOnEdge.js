// SPDX-License-Identifier: GPL-3.0-only
/** meterCoinageTowardCreditOnEdge — one tick of a phase-gated credit drip. A selector bit is rotated into a phase cell;
 * unless its low three bits read 1 the tick does nothing. When they do it requests a sound, bumps a
 * counter, and steps a low/high byte pair: the low byte climbs by sixteen, and only while the high
 * byte trails it is the low byte pulled back and the credit-and-coin tail run. LIVE-OUT: memory. */

import { requestCoinSound } from "./requestCoinSound.js";
import { awardCoinCreditThenPulseCoinCounter } from "./awardCoinCreditThenPulseCoinCounter.js";
import { COIN_ACCEPTED_SLOT_2, COIN_SLOT_2_ACCUMULATOR, COIN_SLOT_2_DEBOUNCE } from "./names.js";

const SELECTOR = 0xa9ae;
const HIGH = 0xa9cc;

const STEP = 0x10;
const PHASE_MASK = 0x07;
const READY = 0x01;

export function meterCoinageTowardCreditOnEdge(m) {
  const { regs, mem8 } = m;

  regs.a = mem8[SELECTOR];
  regs.rrca();
  regs.rrca();
  mem8[COIN_SLOT_2_DEBOUNCE] = regs.rl(mem8[COIN_SLOT_2_DEBOUNCE]); // selector bit shifted in as the low bit
  if ((mem8[COIN_SLOT_2_DEBOUNCE] & PHASE_MASK) !== READY) return;

  requestCoinSound(m);
  mem8[COIN_ACCEPTED_SLOT_2] = (mem8[COIN_ACCEPTED_SLOT_2] + 1) & 0xff;

  const stepped = (mem8[COIN_SLOT_2_ACCUMULATOR] + STEP) & 0xff;
  mem8[COIN_SLOT_2_ACCUMULATOR] = stepped;
  if (mem8[HIGH] >= stepped) return; // stop once the high byte has caught up

  regs.c = mem8[HIGH];
  mem8[COIN_SLOT_2_ACCUMULATOR] = (stepped - ((mem8[HIGH] & 0xf0) + STEP)) & 0xff;
  return awardCoinCreditThenPulseCoinCounter(m);
}
