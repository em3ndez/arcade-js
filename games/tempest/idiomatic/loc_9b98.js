// SPDX-License-Identifier: GPL-3.0-only
import { endObjectMotionScript } from "./endObjectMotionScript.js";
import { writeScriptConstantToSlot } from "./writeScriptConstantToSlot.js";
import { skipScriptOperandWhenFlagClear } from "./skipScriptOperandWhenFlagClear.js";
import { followScriptGoto } from "./followScriptGoto.js";
import { holdSlotPoseUntilTimerExpires } from "./holdSlotPoseUntilTimerExpires.js";
import { noopDispatchStub } from "./noopDispatchStub.js";
import { stepEnemyDepthInLaneDirection } from "./stepEnemyDepthInLaneDirection.js";
import { advanceClimberTrackingColumnMin } from "./advanceClimberTrackingColumnMin.js";
import { writeScriptVariableToSlot } from "./writeScriptVariableToSlot.js";
import { loc_9e5c } from "./loc_9e5c.js";
import { animateFlipperTurn } from "./animateFlipperTurn.js";
import { toggleEnemyTurnSide } from "./toggleEnemyTurnSide.js";
import { spawnType5OnCoordMatch } from "./spawnType5OnCoordMatch.js";
import { jumpScriptCursorWhenFlagClear } from "./jumpScriptCursorWhenFlagClear.js";
import { setFlagIfSlotPastSegmentBound } from "./setFlagIfSlotPastSegmentBound.js";
import { advanceEnemyPursuit } from "./advanceEnemyPursuit.js";
import { fireHitOnPlayerCollision } from "./fireHitOnPlayerCollision.js";
import { steerSlotCoordinate } from "./steerSlotCoordinate.js";
import { faceEnemyTowardPlayerSegment } from "./faceEnemyTowardPlayerSegment.js";
import { setFlagFromPhaseAccumulatorSign } from "./setFlagFromPhaseAccumulatorSign.js";

// Computed jump: the incoming value is a pre-doubled index (the caller left the 2-byte table offset in it)
// that selects one of twenty motion/steering/coordinate handlers and runs it.
const TABLE = [
  endObjectMotionScript, writeScriptConstantToSlot, skipScriptOperandWhenFlagClear, followScriptGoto, holdSlotPoseUntilTimerExpires, noopDispatchStub, stepEnemyDepthInLaneDirection, advanceClimberTrackingColumnMin, writeScriptVariableToSlot, loc_9e5c,
  animateFlipperTurn, toggleEnemyTurnSide, spawnType5OnCoordMatch, jumpScriptCursorWhenFlagClear, setFlagIfSlotPastSegmentBound, advanceEnemyPursuit, fireHitOnPlayerCollision, steerSlotCoordinate, faceEnemyTowardPlayerSegment, setFlagFromPhaseAccumulatorSign,
];
export function loc_9b98(m, a = m.regs.a, x = m.regs.x) {
  // The pre-doubled index a selects one of twenty handlers; the slot x rides in as an explicit arg.
  // a is also the seed Y for the two collision handlers' object-insert tail, so it is threaded as the
  // third arg (ignored by the other handlers).
  return TABLE[a >> 1](m, x, a);
}
