// SPDX-License-Identifier: GPL-3.0-only
/** chaseOneAimPointAndRetireAtTheLine — run one object through a frame of chasing: re-aim, turn, move, dress its
 * sprite, retire it once it drifts onto a retire line. Re-aiming is rationed by the object's phase byte (only on
 * frames whose low nibble matches), spreading a crowd's cost over sixteen frames; turn/move/dress run every frame.
 * The aim point read is ENEMY_STANDOFF_AIM_MAIN, one of six that move together (ONE not THE, neither only nor fixed).
 * The caller's counter pair is restored before the retire test. LIVE-OUT: memory + the two object pointers and counter (unchanged). */

import { u16 } from "../../../core/int.js";
import { ENEMY_STANDOFF_AIM_MAIN, FRAME_TICK } from "./names.js";
import { headingToward } from "./headingToward.js";
import { steerTowardAimOneUnitAFrame } from "./steerTowardAimOneUnitAFrame.js";
import { loc_58aa } from "./loc_58aa.js";
import { dressSpriteShapeAndAttributeForHeadingSector } from "./dressSpriteShapeAndAttributeForHeadingSector.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";

const TURN_PHASE = 15;
const AIM_HEADING = 1;
const PHASE_WHEEL = 15;

export function chaseOneAimPointAndRetireAtTheLine(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;

  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[u16(object + TURN_PHASE)]) {
    mem8[u16(object + AIM_HEADING)] = headingToward(m, ENEMY_STANDOFF_AIM_MAIN);
  }

  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  dressSpriteShapeAndAttributeForHeadingSector(m);

  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}
