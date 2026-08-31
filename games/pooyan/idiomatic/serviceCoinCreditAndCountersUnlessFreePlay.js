// SPDX-License-Identifier: GPL-3.0-only
import { accrueCreditFromDripRingA } from "./accrueCreditFromDripRingA.js";
import { accrueCreditFromCoin1Pulse } from "./accrueCreditFromCoin1Pulse.js";
import { accrueCreditsFromCoinSlot2 } from "./accrueCreditsFromCoinSlot2.js";
import { pulseCoinCounter1Latch } from "./pulseCoinCounter1Latch.js";
import { bumpTamperStrikeOnRomChecksumMiss } from "./bumpTamperStrikeOnRomChecksumMiss.js";
import { pulseCoinCounter2Latch } from "./pulseCoinCounter2Latch.js";
import { COINAGE_CONFIG, COINAGE_CONFIG_SLOT2 } from "./names.js";
/**
 * serviceCoinCreditAndCountersUnlessFreePlay — credit/coinage-gated update chain.
 *
 * When either coinage nibble reads free-play (0x0f), it returns without updating. Otherwise it runs
 * the five per-frame sub-updates (the three score drips, plus the coin-counter strobe and the
 * periodic anti-tamper check) and tails into the credit/attract update.
 *
 * LIVE-OUT: none — a void update chain; every effect is in memory.
 */
const FREE_PLAY = 0x0f;

export function serviceCoinCreditAndCountersUnlessFreePlay(m) {
  const { mem8 } = m;

  if (mem8[COINAGE_CONFIG] === FREE_PLAY) return; // slot 1 free play
  if (mem8[COINAGE_CONFIG_SLOT2] === FREE_PLAY) return; // slot 2 free play

  accrueCreditFromDripRingA(m);
  accrueCreditFromCoin1Pulse(m);
  accrueCreditsFromCoinSlot2(m);
  pulseCoinCounter1Latch(m);
  bumpTamperStrikeOnRomChecksumMiss(m);
  return pulseCoinCounter2Latch(m); // tail
}
