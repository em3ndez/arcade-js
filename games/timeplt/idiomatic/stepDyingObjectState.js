// SPDX-License-Identifier: GPL-3.0-only
/** stepDyingObjectState — step one object's state byte and dispatch on its value: the re-arm value re-seats the
 * byte and begins the death; the threshold begins the death then flies the object on, as does any
 * higher value; below it the byte counts down, retiring the slot at zero, else moving it. LIVE-OUT: memory. */

import { countTheKillAndGrantTheSharedToken } from "./countTheKillAndGrantTheSharedToken.js";
import { decrementObjectStateThenFlyAtSlowestSpeed } from "./decrementObjectStateThenFlyAtSlowestSpeed.js";
import { moveObjectByStateByteThenRunAppearance } from "./moveObjectByStateByteThenRunAppearance.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { u8 } from "../../../core/int.js";

const STATE = 0;
const REARM = 0xf0;
const REARMED_TO = 0x3b;
const DEATH_BEGINS = 0x3c;

export function stepDyingObjectState(m, object = m.regs.ix) {
  const { mem8 } = m;
  const state = mem8[object + STATE];

  if (state === REARM) {
    mem8[object + STATE] = REARMED_TO;
    return countTheKillAndGrantTheSharedToken(m, object);
  }

  // At the threshold the kill is counted first; no reachable object wins a claim, so the count leaves the carry clear and every value at or above the threshold flies on.
  if (state === DEATH_BEGINS) countTheKillAndGrantTheSharedToken(m, object);
  if (state >= DEATH_BEGINS) return decrementObjectStateThenFlyAtSlowestSpeed(m, object);

  const stepped = u8(state - 1);
  mem8[object + STATE] = stepped;
  if (stepped === 0) return retireSlotAndSubPixel(m, object);
  return moveObjectByStateByteThenRunAppearance(m, object);
}
