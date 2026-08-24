// SPDX-License-Identifier: GPL-3.0-only
import { loc_5a06 } from "./loc_5a06.js";
import { accrueCreditFromCoin1Pulse } from "./accrueCreditFromCoin1Pulse.js";
import { accrueCreditsFromCoinSlot2 } from "./accrueCreditsFromCoinSlot2.js";
import { loc_5a9c } from "./loc_5a9c.js";
import { loc_7e6d } from "./loc_7e6d.js";
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

  loc_5a06(m);
  accrueCreditFromCoin1Pulse(m);
  accrueCreditsFromCoinSlot2(m);
  loc_5a9c(m);
  loc_7e6d(m);
  return pulseCoinCounter2Latch(m); // tail
}
