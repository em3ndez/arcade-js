// SPDX-License-Identifier: GPL-3.0-only
/** serviceCoinInputs — one frame of coin-input service: run the two coin-slot debounce handlers and the
 * phase-gated credit drip, then pulse each mechanical coin counter once per coin still owed. Every
 * call rotates the debounce histories; crediting and pulsing fire only on an edge or a debt. LIVE-OUT: memory, plus the latched coin-counter lines. */

import { awardOneCreditOnDebouncedInputEdge } from "./awardOneCreditOnDebouncedInputEdge.js";
import { tallyCoinSlot1AndAwardCredit } from "./tallyCoinSlot1AndAwardCredit.js";
import { meterCoinageTowardCreditOnEdge } from "./meterCoinageTowardCreditOnEdge.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";
import { pulseSlot2CoinCounter } from "./pulseSlot2CoinCounter.js";

export function serviceCoinInputs(m) {
  awardOneCreditOnDebouncedInputEdge(m);
  tallyCoinSlot1AndAwardCredit(m);
  meterCoinageTowardCreditOnEdge(m);
  pulseSlot1CoinCounter(m);
  pulseSlot2CoinCounter(m);
}
