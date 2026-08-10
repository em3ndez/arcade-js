// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra3EnemyCraftSlot — the era-3 step for one object slot, dispatched on the slot's lifecycle byte at ix+0:
 * an idle slot does nothing; a live slot (0xff) is steered, dressed, then either retired at the
 * line or flown on and given a spawn attempt; 0xfe releases a held slot; a lower value is a death
 * countdown step. LIVE-OUT: memory. */

import { steerTowardAimHeading } from "./steerTowardAimHeading.js";
import { loc_58a4 } from "./loc_58a4.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { launchBankEnemyWhenAimedNearPlayer } from "./launchBankEnemyWhenAimedNearPlayer.js";
import { dressSpriteForCoarseHeading } from "./dressSpriteForCoarseHeading.js";
import { launchAttackerIntoFreeSlot } from "./launchAttackerIntoFreeSlot.js";
import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";

const IDLE = 0;
const LIVE = 0xff;
const HELD = 0xfe;

export function serviceEra3EnemyCraftSlot(m) {
  const state = m.mem8[m.regs.ix];
  if (state === IDLE) return;
  if (state !== LIVE) {
    if (state === HELD) return releaseHeldObject(m);
    return stepDyingObjectState(m);
  }
  steerTowardAimHeading(m);
  loc_58a4(m);
  if (hasReachedRetireLine(m)) return retireSlotAndSubPixel(m);
  launchBankEnemyWhenAimedNearPlayer(m);
  dressSpriteForCoarseHeading(m);
  return launchAttackerIntoFreeSlot(m);
}
