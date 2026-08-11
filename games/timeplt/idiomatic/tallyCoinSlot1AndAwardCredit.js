// SPDX-License-Identifier: GPL-3.0-only
/** tallyCoinSlot1AndAwardCredit — one frame of coin slot 1's accounting. The raw coin line is clocked into a debounce
 * shift register and only a clean rising edge (its low three bits reading 1) counts as a coin: it
 * blips the coin sound, bumps the tally, and adds a unit to the coins-inserted accumulator. Once the
 * accumulator passes the coinage threshold (coins-per-credit in the high nibble, credits awarded in
 * the low), the overshoot is carried forward and — unless the no-credit flag is set — the low nibble
 * is added to the packed-decimal credit count (saturated at 99) and its panel repainted. Either way
 * the mechanical coin counter is pulsed. LIVE-OUT: memory, plus the latched counter line. */

import { requestCoinSound } from "./requestCoinSound.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";
import { COIN_SLOT_1_ACCUMULATOR, COIN_SLOT_1_DEBOUNCE, CREDIT_COUNT } from "./names.js";

const COIN_SAMPLE = 0xa9ae;
const COIN_TALLY = 0xa981;
const COINAGE = 0xa9c9;
const NO_CREDIT = 0xa9c0;

export function tallyCoinSlot1AndAwardCredit(m) {
  const { regs, mem8 } = m;

  regs.a = mem8[COIN_SAMPLE];
  regs.hl = COIN_SLOT_1_DEBOUNCE;
  regs.rrca();
  mem8[regs.hl] = regs.rl(mem8[regs.hl]);
  regs.a = mem8[regs.hl];
  regs.and(0x07);
  regs.cp(0x01);
  if (regs.fNZ) return; // not the clean rising edge

  requestCoinSound(m);
  mem8[COIN_TALLY] = mem8[COIN_TALLY] + 1;

  regs.hl = COIN_SLOT_1_ACCUMULATOR;
  regs.a = mem8[regs.hl];
  regs.add(0x10);
  mem8[regs.hl] = regs.a;
  regs.b = regs.a;
  regs.hl = COINAGE;
  regs.a = mem8[regs.hl];
  regs.sub(regs.b);
  if (regs.fNC) return; // still short of a credit

  regs.a = mem8[regs.hl];
  regs.c = regs.a; // the whole coinage byte
  regs.and(0xf0);
  regs.add(0x10);
  regs.hl = COIN_SLOT_1_ACCUMULATOR;
  regs.neg();
  regs.add(mem8[regs.hl]);
  mem8[regs.hl] = regs.a; // carry the overshoot forward

  if (mem8[NO_CREDIT] !== 0) return pulseSlot1CoinCounter(m);

  regs.a = regs.c & 0x0f;
  regs.hl = CREDIT_COUNT;
  regs.add(mem8[regs.hl]);
  regs.daa();
  mem8[regs.hl] = regs.fNC ? regs.a : 0x99; // BCD add, saturated at 99
  paintCreditCountPanel(m);
  return pulseSlot1CoinCounter(m);
}
