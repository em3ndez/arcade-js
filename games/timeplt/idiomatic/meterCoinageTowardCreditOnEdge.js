// SPDX-License-Identifier: GPL-3.0-only
/** meterCoinageTowardCreditOnEdge — one tick of a phase-gated credit drip. A selector bit is rotated into a phase cell;
 * unless its low three bits read 1 the tick does nothing. When they do it requests a sound, bumps a
 * counter, and steps a low/high byte pair: the low byte climbs by sixteen, and only while the high
 * byte trails it is the low byte pulled back and the credit-and-coin tail run. LIVE-OUT: memory. */

import { loc_57f1 } from "./loc_57f1.js";
import { awardCoinCreditThenPulseCoinCounter } from "./awardCoinCreditThenPulseCoinCounter.js";

const SELECTOR = 0xa9ae;
const PHASE = 0xa9ca;
const TICK = 0xa982;
const LOW = 0xa9cb;
const HIGH = 0xa9cc;

const STEP = 0x10;
const PHASE_MASK = 0x07;
const READY = 0x01;

export function meterCoinageTowardCreditOnEdge(m) {
  const { regs, mem8 } = m;

  regs.a = mem8[SELECTOR];
  regs.rrca();
  regs.rrca();
  mem8[PHASE] = regs.rl(mem8[PHASE]); // selector bit shifted in as the low bit
  if ((mem8[PHASE] & PHASE_MASK) !== READY) return;

  loc_57f1(m);
  mem8[TICK] = (mem8[TICK] + 1) & 0xff;

  const stepped = (mem8[LOW] + STEP) & 0xff;
  mem8[LOW] = stepped;
  if (mem8[HIGH] >= stepped) return; // stop once the high byte has caught up

  regs.c = mem8[HIGH];
  mem8[LOW] = (stepped - ((mem8[HIGH] & 0xf0) + STEP)) & 0xff;
  return awardCoinCreditThenPulseCoinCounter(m);
}
