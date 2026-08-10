// SPDX-License-Identifier: GPL-3.0-only
/** loc_29d5 — service one object slot by its lifecycle byte: idle when free, release when held,
 * step when dying, and when live steer it, retire it on the line, else animate and try a launch. */

import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";
import { steerEnemyTowardShip } from "./steerEnemyTowardShip.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { animateSelectedShapeCycle } from "./animateSelectedShapeCycle.js";
import { loc_3ed6 } from "./loc_3ed6.js";
import { launchAttackerIntoFreeSlot } from "./launchAttackerIntoFreeSlot.js";

const FREE = 0;
const HELD = 0xfe;
const LIVE = 0xff;

export function loc_29d5(m) {
  const state = m.mem8[m.regs.ix];
  if (state === FREE) return;
  if (state === HELD) return releaseHeldObject(m);
  if (state !== LIVE) return stepDyingObjectState(m);

  steerEnemyTowardShip(m);
  if (hasReachedRetireLine(m)) return retireSlotAndSubPixel(m);
  animateSelectedShapeCycle(m);
  loc_3ed6(m);
  launchAttackerIntoFreeSlot(m);
}
