// SPDX-License-Identifier: GPL-3.0-only
/** stepSlotApproachThenBreakawayRetire — the per-frame handler for one slot in an object sweep. The record byte at +4 is an
 * approach countdown: while it runs, count it down by one and drive the object through its full
 * chased-object frame. The tick it reaches zero, fly the object at double velocity, animate its
 * shape, and retire the slot only if it has drifted onto a retire line. Either way step the sweep
 * onto the next slot. The record, its sprite entry and the sweep's turns left are arguments, handed
 * on to the turn-closer. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { OPENING_ERA_VELOCITY_TABLE } from "./names.js";
import { flyAlongHeadingAtDoubleVelocity } from "./flyAlongHeadingAtDoubleVelocity.js";
import { animateFixedShapeCycleAtHalfRate } from "./animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";
import { flyTowardShipStandoffThenEndApproach } from "./flyTowardShipStandoffThenEndApproach.js";

const COUNTDOWN = 4;
// the velocity table the breakaway flies the object along
const BREAKAWAY_VELOCITY_TABLE = OPENING_ERA_VELOCITY_TABLE;

export function stepSlotApproachThenBreakawayRetire(m, ix = m.regs.ix, iy = m.regs.iy, b = m.regs.b) {
  const { mem8 } = m;
  const countdown = u16(ix + COUNTDOWN);

  if (mem8[countdown] === 0) {
    flyAlongHeadingAtDoubleVelocity(m, BREAKAWAY_VELOCITY_TABLE, ix, iy);
    animateFixedShapeCycleAtHalfRate(m, iy);
    if (hasReachedRetireLine(m, iy)) retireSlot(m, ix, iy);
    return closeOneTurnOfTheSlotSweep(m, ix, iy, b);
  }

  mem8[countdown] = (mem8[countdown] - 1);
  flyTowardShipStandoffThenEndApproach(m, ix, iy);
  return closeOneTurnOfTheSlotSweep(m, ix, iy, b);
}
