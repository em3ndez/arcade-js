// SPDX-License-Identifier: GPL-3.0-only
/** awardCoinCreditThenPulseCoinCounter — credit one coin's worth on screen, then pulse the mechanical counter. Outside free
 * play the low decimal digit arriving in C is folded into the packed-decimal credit count (decimal
 * add, saturated at 99) and its two-digit field repainted; then the coin-counter pulse runs either
 * way. LIVE-OUT: memory, plus the latched counter line. */

import { FREE_PLAY } from "./names.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";

const CREDIT_COUNT = 0xa986;
const CREDIT_CAP = 0x99;
const DIGIT_MASK = 0x0f;

export function awardCoinCreditThenPulseCoinCounter(m) {
  const { regs, mem8 } = m;
  if (mem8[FREE_PLAY] === 0) {
    regs.a = regs.c & DIGIT_MASK;
    regs.add(mem8[CREDIT_COUNT]);
    regs.daa();
    mem8[CREDIT_COUNT] = regs.fNC ? regs.a : CREDIT_CAP;
    paintCreditCountPanel(m);
  }
  return pulseSlot1CoinCounter(m);
}
