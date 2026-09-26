// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra1EnemyCraftSlot — run one object slot, dispatched on its status byte: an empty slot is left alone, a held object is
 * released, a dying one is stepped, and an active craft is steered and flown, retired the frame it
 * reaches the line, else given one launch attempt and its sprite refreshed from its heading.
 * LIVE-OUT: memory; on the refreshed path, the accumulator and flags the sprite refresh leaves. */

import { steerTowardAimHeading } from "./steerTowardAimHeading.js";
import { loc_5854 } from "./loc_5854.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { launchBankEnemyWhenAimedNearPlayer } from "./launchBankEnemyWhenAimedNearPlayer.js";
import { refreshSecondEraSpriteFromHeading } from "./refreshSecondEraSpriteFromHeading.js";
import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";

const EMPTY = 0;
const HELD = 0xfe;
const ACTIVE = 0xff;

export function serviceEra1EnemyCraftSlot(m, ix = m.regs.ix) {
  const status = m.mem8[ix];
  if (status === EMPTY) return;
  if (status === HELD) return releaseHeldObject(m);
  if (status !== ACTIVE) return stepDyingObjectState(m);

  steerTowardAimHeading(m);
  loc_5854(m);
  if (hasReachedRetireLine(m)) return retireSlotAndSubPixel(m);
  launchBankEnemyWhenAimedNearPlayer(m);
  return refreshSecondEraSpriteFromHeading(m);
}
