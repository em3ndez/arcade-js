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
  const { regs, mem8 } = m;

  regs.ix = MARIO_ACTIVE; // base of Mario's context block

  // Snapshot where this frame started, before any motion — the collision pass reads it back.
  mem8[MARIO_AIR_PREV_X] = mem8[MARIO_X];
  mem8[MARIO_AIR_PREV_Y] = mem8[MARIO_Y];

  stepBallisticMotion(m);
  const { d: pushRight } = limitMarioHorizontalTravel(m);

  // Not the push-right verdict: hand to the far-right-edge arm.
  if (pushRight !== 1) return loc_1bf2(m);

  // Push right: drift at +0.5 px/frame (velocity in 1/256 px units) and face right.
  mem8[MARIO_AIR_VX_HI] = 0;
  mem8[MARIO_AIR_VX_LO] = 128;
  mem8[MARIO_SPRITE_CODE] = mem8[MARIO_SPRITE_CODE] | FACING_RIGHT;

  return reverseMarioVerticalArc(m);
}
