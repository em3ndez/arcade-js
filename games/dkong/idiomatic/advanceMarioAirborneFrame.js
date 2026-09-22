// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceMarioAirborneFrame — the airborne frame's head: snapshot Mario's pre-motion position,
 * advance his jump/fall arc one frame, then let the horizontal position gate steer him near the
 * left playfield limit.
 *
 * LIVE-OUT: memory, plus whatever the tail cascade leaves. Own writes: MARIO_AIR_PREV_X,
 * MARIO_AIR_PREV_Y, MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_SPRITE_CODE.
 */

import {
  MARIO_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_AIR_PREV_X,
  MARIO_AIR_PREV_Y,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
} from "./names.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js";
import { loc_1bf2 } from "./loc_1bf2.js";
import { reverseMarioVerticalArc } from "./reverseMarioVerticalArc.js";

// Bit 7 of MARIO_SPRITE_CODE is the horizontal-flip bit: set = facing right.
const FACING_RIGHT = 0x80;

export function advanceMarioAirborneFrame(m) {
  const { mem8 } = m;

  // Base of Mario's context block, threaded to the ballistic step and the arc cascade so the
  // downstream reads no longer depend on a seated register.
  const record = MARIO_ACTIVE;

  // Snapshot where this frame started, before any motion — the collision pass reads it back.
  mem8[MARIO_AIR_PREV_X] = mem8[MARIO_X];
  mem8[MARIO_AIR_PREV_Y] = mem8[MARIO_Y];

  stepBallisticMotion(m, record);
  const { d: pushRight } = limitMarioHorizontalTravel(m);

  // Not the push-right verdict: hand to the far-right-edge arm.
  if (pushRight !== 1) return loc_1bf2(m, undefined, undefined, record);

  // Push right: drift at +0.5 px/frame (velocity in 1/256 px units) and face right.
  mem8[MARIO_AIR_VX_HI] = 0;
  mem8[MARIO_AIR_VX_LO] = 128;
  mem8[MARIO_SPRITE_CODE] = mem8[MARIO_SPRITE_CODE] | FACING_RIGHT;

  return reverseMarioVerticalArc(m, record);
}
