// SPDX-License-Identifier: GPL-3.0-only
/** chaseOneAimPointAndRetireAtTheLine — run one object through a frame of chasing: re-aim, turn, move, dress its
 * sprite, retire it once it drifts onto a retire line. Re-aiming is rationed by the object's phase byte (only on
 * frames whose low nibble matches), spreading a crowd's cost over sixteen frames; turn/move/dress run every frame.
 * The aim point read is ENEMY_STANDOFF_AIM_MAIN, one of six that move together (ONE not THE, neither only nor fixed).
 * The record and its sprite entry are arguments. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { ENEMY_STANDOFF_AIM_MAIN, FRAME_TICK, loc_59d7 } from "./names.js";
import { headingToward } from "./headingToward.js";
import { steerTowardAimOneUnitAFrame } from "./steerTowardAimOneUnitAFrame.js";
import { flyAlongHeadingAtDoubleVelocity } from "./flyAlongHeadingAtDoubleVelocity.js";
import { dressSpriteShapeAndAttributeForHeadingSector } from "./dressSpriteShapeAndAttributeForHeadingSector.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";

const TURN_PHASE = 15;
const AIM_HEADING = 1;
const PHASE_WHEEL = 15;
// the velocity table a chased object flies along
const CHASE_VELOCITY_TABLE = loc_59d7;

export function chaseOneAimPointAndRetireAtTheLine(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;

  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[u16(object + TURN_PHASE)]) {
    mem8[u16(object + AIM_HEADING)] = headingToward(m, ENEMY_STANDOFF_AIM_MAIN, sprite);
  }

  steerTowardAimOneUnitAFrame(m, object);
  flyAlongHeadingAtDoubleVelocity(m, CHASE_VELOCITY_TABLE, object, sprite);
  dressSpriteShapeAndAttributeForHeadingSector(m, object, sprite);

  if (hasReachedRetireLine(m, sprite)) retireSlot(m, object, sprite);
}
