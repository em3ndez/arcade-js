// SPDX-License-Identifier: GPL-3.0-only
/** awardCoinCreditThenPulseCoinCounter — credit one coin's worth on screen, then pulse the mechanical counter. Outside free
 * play the low decimal digit arriving in C is folded into the packed-decimal credit count (decimal
 * add, saturated at 99) and its two-digit field repainted; then the coin-counter pulse runs either
 * way. LIVE-OUT: memory, plus the latched counter line. */

import { CREDIT_COUNT, FREE_PLAY } from "./names.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";
import { bcdAddByte } from "../../../core/bcd.js";

const CREDIT_CAP = 0x99;
const DIGIT_MASK = 0x0f;

export function awardCoinCreditThenPulseCoinCounter(m, c = m.regs.c) {
  const { mem8 } = m;
  if (mem8[FREE_PLAY] === 0) {
    // BCD-add the coin's low digit into the packed-BCD credit count; a carry out means it passed 99,
    // so it saturates at 0x99.
    const { value, carry } = bcdAddByte(mem8[CREDIT_COUNT], c & DIGIT_MASK);
    mem8[CREDIT_COUNT] = carry ? CREDIT_CAP : value;
    paintCreditCountPanel(m);
  }
  return pulseSlot1CoinCounter(m);
}
