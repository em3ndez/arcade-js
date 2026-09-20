// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c41 — head of the barrel slot-claim cluster: stir the random seed, then route to one of two
 * claim-mode entries on the seed's low nibble. A nonzero nibble (15 of 16) runs the mode-3 entry,
 * which pre-clears the slot-claim request flag; a zero nibble (1 of 16) runs the mode-1 entry. Both
 * then gate on the caller's bonus value and, when the gate fires, claim the first free object slot.
 *
 * A claim ends by raising bit 7 of the barrel claim-mode byte, which the next barrel reads to pick
 * its kind: bit-7-clear rolls along the girders, bit-7-set drops with its X pinned. So this coin
 * flip is one input into what the next barrel does. Which named object each kind is: not claimed.
 * The bonus value stays the caller's — the seed stir leaves it alone. LIVE-OUT: memory-only.
 */

import { stirRandomSeed } from "./stirRandomSeed.js";
import { loc_2c86 } from "./loc_2c86.js";
import { loc_2c49 } from "./loc_2c49.js";

export function loc_2c41(m) {
  const [seed] = stirRandomSeed(m);

  if ((seed & 0x0f) !== 0) {
    loc_2c86(m);
  } else {
    loc_2c49(m);
  }
}
