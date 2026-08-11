// SPDX-License-Identifier: GPL-3.0-only
/** awardOneCreditOnDebouncedInputEdge — debounce bit 2 of the input-port mirror through a rolling history cell, and only on a
 * clean leading edge (its low three bits reading 001) request a sound and award one credit. LIVE-OUT: the history cell, and on the edge the credit count, the sound queue and the coin-counter latch. */

import { requestCoinSound } from "./requestCoinSound.js";
import { awardCoinCreditThenPulseCoinCounter } from "./awardCoinCreditThenPulseCoinCounter.js";
import { IN0_MIRROR } from "./names.js";

const HISTORY = 0xa983;
const INPUT_BIT = 2;
const EDGE = 0x01;
const LOW3 = 0x07;
const ONE_CREDIT = 0x01;

export function awardOneCreditOnDebouncedInputEdge(m) {
  const { regs, mem8 } = m;
  const bit = (mem8[IN0_MIRROR] >> INPUT_BIT) & 1;
  const history = ((mem8[HISTORY] << 1) | bit) & 0xff;
  mem8[HISTORY] = history;
  if ((history & LOW3) !== EDGE) return;
  requestCoinSound(m);
  regs.c = ONE_CREDIT;
  return awardCoinCreditThenPulseCoinCounter(m);
}
