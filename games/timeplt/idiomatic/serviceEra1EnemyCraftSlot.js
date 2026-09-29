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

export function serviceEra1EnemyCraftSlot(m, ix = m.regs.ix, iy = m.regs.iy) {
  // The slot's record and sprite entry are handed to every step that takes them, so a slot named
  // here is the slot every step works on.
  const status = m.mem8[ix];
  if (status === EMPTY) return;
  if (status === HELD) return releaseHeldObject(m, ix);
  if (status !== ACTIVE) return stepDyingObjectState(m, ix, iy);

  steerTowardAimHeading(m, ix);
  loc_5854(m, ix, iy);
  if (hasReachedRetireLine(m, iy)) return retireSlotAndSubPixel(m, ix, iy);
  launchBankEnemyWhenAimedNearPlayer(m, ix, iy);
  return refreshSecondEraSpriteFromHeading(m, ix, iy);
}
