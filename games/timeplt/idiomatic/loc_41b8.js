// SPDX-License-Identifier: GPL-3.0-only
/** loc_41b8 — run one chased object through a frame: on every sixteenth frame re-aim it at one of
 * two fixed points, a bit in its record choosing which, and once it has arrived there cut its
 * approach countdown to zero so its handler retires it next frame; then turn, move and dress it
 * every frame. LIVE-OUT: memory; the carry mirrors whether it reached a retire line; BC passes
 * through. */

import { u8, u16 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";
import { headingToward } from "./headingToward.js";
import { endApproachNow } from "./endApproachNow.js";
import { steerTowardAimAtFixedRate } from "./steerTowardAimAtFixedRate.js";
import { loc_58b6 } from "./loc_58b6.js";
import { animateFixedShapeCycleAtHalfRate } from "./animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";

const REAIM_MASK = 0x0f;
const AIM_SELECTOR = 15;
const AIM_POINT_IF_SET = 0xac75;
const AIM_POINT_IF_CLEAR = 0xac79;
const AIM_HEADING = 1;
const SECOND_COORD = 49;
const ARRIVED = 16;

export function loc_41b8(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;

  if ((mem8[FRAME_TICK] & REAIM_MASK) === 0) {
    const point = mem8[u16(regs.ix + AIM_SELECTOR)] & 1 ? AIM_POINT_IF_SET : AIM_POINT_IF_CLEAR;
    mem8[u16(regs.ix + AIM_HEADING)] = headingToward(m, point);
    // headingToward drops the two axis gaps it measures; recompute them to spot arrival.
    const firstGap = Math.abs(mem8[point] - mem8[regs.iy]);
    const secondGap =
      Math.abs(mem8[(point & 0xff00) | u8(point - 1)] - mem8[u16(regs.iy + SECOND_COORD)]);
    if (firstGap < ARRIVED && secondGap < ARRIVED) endApproachNow(m, regs.ix);
  }

  steerTowardAimAtFixedRate(m);
  loc_58b6(m);
  animateFixedShapeCycleAtHalfRate(m);

  regs.bc = held;
  return hasReachedRetireLine(m);
}
