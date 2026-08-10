// SPDX-License-Identifier: GPL-3.0-only
/** serviceCoinInputs — one frame of coin-input service: run the two coin-slot debounce handlers and the
 * phase-gated credit drip, then pulse each mechanical coin counter once per coin still owed. Every
 * call rotates the debounce histories; crediting and pulsing fire only on an edge or a debt. LIVE-OUT: memory, plus the latched coin-counter lines. */

import { loc_48e7 } from "./loc_48e7.js";
import { loc_4941 } from "./loc_4941.js";
import { loc_4911 } from "./loc_4911.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";
import { loc_49d6 } from "./loc_49d6.js";

export function serviceCoinInputs(m) {
  loc_48e7(m);
  loc_4941(m);
  loc_4911(m);
  pulseSlot1CoinCounter(m);
  loc_49d6(m);
}
