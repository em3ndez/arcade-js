// SPDX-License-Identifier: GPL-3.0-only
/**
 * reverseMarioVerticalArc — re-base Mario's vertical arc at his current position by folding the
 * elapsed airborne frames back into the launch velocity (new velocity = 16·frames − velocity,
 * frame count reset), unless the fall is already latched lethal (MARIO_FATAL_FALL); then tail into
 * the shared ballistic-step + airborne cascade.
 *
 * LIVE-OUT: memory-only — the two velocity bytes and the frame count, plus everything the shared
 * tail writes, and the tail's own forwarded return value.
 */

import {
  MARIO_FATAL_FALL,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
} from "./names.js";
import { loc_2407 } from "./loc_2407.js";
import { loc_1bec } from "./loc_1bec.js";

export function reverseMarioVerticalArc(m, record = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[MARIO_FATAL_FALL] !== 1) {
    const rebasedVelocity = loc_2407(m, record);
    mem8[MARIO_AIR_VY_HI] = rebasedVelocity >> 8;
    mem8[MARIO_AIR_VY_LO] = rebasedVelocity;
    mem8[MARIO_AIR_FRAMES] = 0;
  }

  return loc_1bec(m, record);
}
