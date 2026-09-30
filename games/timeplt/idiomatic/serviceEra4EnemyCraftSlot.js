// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra4EnemyCraftSlot — service one object slot by its lifecycle byte: idle when free, release when held,
 * step when dying, and when live steer it, retire it on the line, else animate and try a launch. */

import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";
import { steerEnemyTowardShip } from "./steerEnemyTowardShip.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { animateSelectedShapeCycle } from "./animateSelectedShapeCycle.js";
import { launchBankEnemyWhenAimedNearPlayer } from "./launchBankEnemyWhenAimedNearPlayer.js";
import { launchAttackerIntoFreeSlot } from "./launchAttackerIntoFreeSlot.js";

const FREE = 0;
const HELD = 0xfe;
const LIVE = 0xff;

export function serviceEra4EnemyCraftSlot(m, ix = m.regs.ix, iy = m.regs.iy) {
  const state = m.mem8[ix];
  if (state === FREE) return;
  if (state === HELD) return releaseHeldObject(m, ix);
  if (state !== LIVE) return stepDyingObjectState(m, ix, iy);

  steerEnemyTowardShip(m, iy, ix);
  if (hasReachedRetireLine(m, iy)) return retireSlotAndSubPixel(m, ix, iy);
  animateSelectedShapeCycle(m, ix, iy);
  launchBankEnemyWhenAimedNearPlayer(m, ix, iy);
  launchAttackerIntoFreeSlot(m, ix, iy);
}
