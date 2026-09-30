// SPDX-License-Identifier: GPL-3.0-only
/** flyTowardShipStandoffThenEndApproach — run one chased object through a frame: on every sixteenth frame re-aim it at one of
 * two fixed points, a bit in its record choosing which, and once it has arrived there cut its
 * approach countdown to zero so its handler retires it next frame; then turn, move and dress it
 * every frame. The record and its sprite entry are arguments. LIVE-OUT: memory; whether it
 * reached a retire line is returned. */

import { u8, u16 } from "../../../core/int.js";
import { ENEMY_STANDOFF_AIM_CLEAR, ENEMY_STANDOFF_AIM_SET, FRAME_TICK, OPENING_ERA_VELOCITY_TABLE } from "./names.js";
import { headingToward } from "./headingToward.js";
import { endApproachNow } from "./endApproachNow.js";
import { steerTowardAimAtFixedRate } from "./steerTowardAimAtFixedRate.js";
import { flyAlongHeadingAtDoubleVelocity } from "./flyAlongHeadingAtDoubleVelocity.js";
import { animateFixedShapeCycleAtHalfRate } from "./animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";

const REAIM_MASK = 0x0f;
const AIM_SELECTOR = 15;
const AIM_HEADING = 1;
const SECOND_COORD = 49;
const ARRIVED = 16;
// the velocity table an approaching object flies along
const APPROACH_VELOCITY_TABLE = OPENING_ERA_VELOCITY_TABLE;

export function flyTowardShipStandoffThenEndApproach(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  if ((mem8[FRAME_TICK] & REAIM_MASK) === 0) {
    const point = mem8[u16(ix + AIM_SELECTOR)] & 1 ? ENEMY_STANDOFF_AIM_SET : ENEMY_STANDOFF_AIM_CLEAR;
    mem8[u16(ix + AIM_HEADING)] = headingToward(m, point, iy);
    // headingToward drops the two axis gaps it measures; recompute them to spot arrival.
    const firstGap = Math.abs(mem8[point] - mem8[iy]);
    const secondGap =
      Math.abs(mem8[(point & (0xff << 8)) | u8(point - 1)] - mem8[u16(iy + SECOND_COORD)]);
    if (firstGap < ARRIVED && secondGap < ARRIVED) endApproachNow(m, ix);
  }

  steerTowardAimAtFixedRate(m, ix);
  flyAlongHeadingAtDoubleVelocity(m, APPROACH_VELOCITY_TABLE, ix, iy);
  animateFixedShapeCycleAtHalfRate(m, iy);

  return hasReachedRetireLine(m, iy);
}
