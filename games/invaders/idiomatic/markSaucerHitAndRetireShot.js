// SPDX-License-Identifier: GPL-3.0-only
import { SAUCER_HIT } from "./names.js";
import { retirePlayerShot } from "./retirePlayerShot.js";

// Raise the saucer-hit flag (the saucer enters its explosion/score sequence), then retire the player shot; value-out A.
export function markSaucerHitAndRetireShot(m) {
  m.mem8[SAUCER_HIT] = 0x01;
  return retirePlayerShot(m);
}
