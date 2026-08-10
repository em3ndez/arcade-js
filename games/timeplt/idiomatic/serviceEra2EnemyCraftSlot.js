// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra2EnemyCraftSlot — run one object slot, dispatched on its state byte (ix+0): the empty value does
 * nothing; the active value flies it — steered toward its aim three frames in four, moved at the
 * slow speed, retired once it reaches a retire line, else its sprite is dressed and two launch
 * attempts run; the held value releases it; any other value steps its dying state. LIVE-OUT: memory. */

import { steerTowardAimHeading } from "./steerTowardAimHeading.js";
import { flyAtSlowestSpeed } from "./flyAtSlowestSpeed.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { loc_3ed6 } from "./loc_3ed6.js";
import { dressSpriteForFineHeading } from "./dressSpriteForFineHeading.js";
import { launchAttackerIntoFreeSlot } from "./launchAttackerIntoFreeSlot.js";
import { releaseHeldObject } from "./releaseHeldObject.js";
import { stepDyingObjectState } from "./stepDyingObjectState.js";
import { FRAME_TICK } from "./names.js";

const ACTIVE = 0xff;
const HELD = 0xfe;
const STEER_MASK = 3;

export function serviceEra2EnemyCraftSlot(m) {
  const { regs, mem8 } = m;
  const state = mem8[regs.ix];
  if (state === 0) return;

  if (state === ACTIVE) {
    if ((mem8[FRAME_TICK] & STEER_MASK) < STEER_MASK) steerTowardAimHeading(m);
    flyAtSlowestSpeed(m);
    if (hasReachedRetireLine(m)) return retireSlotAndSubPixel(m);
    loc_3ed6(m);
    dressSpriteForFineHeading(m);
    launchAttackerIntoFreeSlot(m);
    return;
  }

  if (state === HELD) return releaseHeldObject(m);
  return stepDyingObjectState(m);
}
