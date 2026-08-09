// SPDX-License-Identifier: GPL-3.0-only
/** loc_4194 — the per-frame handler for one slot in an object sweep. The record byte at +4 is an
 * approach countdown: while it runs, count it down by one and drive the object through its full
 * chased-object frame. The tick it reaches zero, fly the object at double velocity, animate its
 * shape, and retire the slot only if it has drifted onto a retire line. Either way step the sweep
 * onto the next slot. LIVE-OUT: memory and the sweep cursors; BC is held across the zero branch. */

import { u16 } from "../../../core/int.js";
import { loc_58b6 } from "./loc_58b6.js";
import { animateFixedShapeCycleAtHalfRate } from "./animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";
import { flyTowardShipStandoffThenEndApproach } from "./flyTowardShipStandoffThenEndApproach.js";

const COUNTDOWN = 4;

export function loc_4194(m) {
  const { regs, mem8 } = m;
  const countdown = u16(regs.ix + COUNTDOWN);

  if (mem8[countdown] === 0) {
    const held = regs.bc; // the object work clobbers BC; the sweep count rides in B
    loc_58b6(m);
    animateFixedShapeCycleAtHalfRate(m);
    const reached = hasReachedRetireLine(m);
    regs.bc = held;
    if (reached) retireSlot(m);
    return closeOneTurnOfTheSlotSweep(m);
  }

  mem8[countdown] = (mem8[countdown] - 1) & 0xff;
  flyTowardShipStandoffThenEndApproach(m);
  return closeOneTurnOfTheSlotSweep(m);
}
