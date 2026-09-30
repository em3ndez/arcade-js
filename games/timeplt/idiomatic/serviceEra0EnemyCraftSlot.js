// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra0EnemyCraftSlot — the era-0 per-object update, branched on the object's status byte: an empty slot is
 * left alone, a held object is released, a dying one is stepped, and an active craft is steered,
 * flown and refreshed then allowed to spawn, or retired the frame it reaches the line. LIVE-OUT: memory. */

import { steerTowardAimHeading } from "./steerTowardAimHeading.js";
import { flyAtSlowestSpeed } from "./flyAtSlowestSpeed.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { launchBankEnemyWhenAimedNearPlayer } from "./launchBankEnemyWhenAimedNearPlayer.js";
import { refreshSpriteFromHeading } from "./refreshSpriteFromHeading.js";
import { launchAttackerIntoFreeSlot } from "./launchAttackerIntoFreeSlot.js";
import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";

const EMPTY = 0;
const HELD = 0xfe;
const ACTIVE = 0xff;

export function serviceEra0EnemyCraftSlot(m, ix = m.regs.ix, iy = m.regs.iy) {
  const status = m.mem8[ix];
  if (status === EMPTY) return;
  if (status === HELD) return releaseHeldObject(m, ix);
  if (status !== ACTIVE) return stepDyingObjectState(m, ix, iy);

  steerTowardAimHeading(m, ix);
  flyAtSlowestSpeed(m, ix, iy);
  if (hasReachedRetireLine(m, iy)) return retireSlotAndSubPixel(m, ix, iy);
  launchBankEnemyWhenAimedNearPlayer(m, ix, iy);
  refreshSpriteFromHeading(m, iy, ix);
  return launchAttackerIntoFreeSlot(m, ix, iy);
}
