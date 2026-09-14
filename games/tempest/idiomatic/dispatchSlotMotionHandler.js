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
import { stepClimberSegmentGuarded } from "./stepClimberSegmentGuarded.js";
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

/**
 * dispatchSlotMotionHandler — route a per-slot motion-script opcode to its handler. ROM 0x9b98.
 *
 * Role in the machine: enemies on the tube (flippers, pulsars, spikers, tankers, the climbers walking a
 * lane) are driven by tiny per-object "motion scripts" — a byte stream of opcodes the frame walker at
 * loc_9b1e steps through for each active slot. Each opcode is an index into a twenty-entry jump table of
 * motion / steering / coordinate primitives: end-of-script, immediate/variable stores into the object's
 * cells, conditional operand skips and gotos, depth stepping down a lane, flipper turn animation, turn-
 * side toggles, type-5 spawns, segment-bound flag tests, pursuit and player-collision handling, and the
 * spinner-style coordinate steer. This routine is the 6502 computed-JMP at the centre of that walker.
 *
 * Behaviour: the incoming value a is a PRE-DOUBLED table offset (the caller already left the 2-byte-per-
 * entry ROM offset in it); halve it (>>1) to index the JS TABLE of twenty handlers and tail-call the one
 * selected. The acting slot index x is passed through as an explicit argument. a itself is also threaded
 * as a third argument: the two collision handlers (fireHitOnPlayerCollision and steerSlotCoordinate reach
 * an object-insert tail that) reuse the offset as the seed Y for their object-insert; every other handler
 * ignores the extra arg.
 *
 * Live-out: none of its own — each handler mutates the acting object's cells (depth, coordinate, flags,
 * script cursor) or emits its effect, and its result returns to loc_9b1e's slot walk. Grounding: [seen].
 */
const TABLE = [
  endObjectMotionScript, writeScriptConstantToSlot, skipScriptOperandWhenFlagClear, followScriptGoto, holdSlotPoseUntilTimerExpires, noopDispatchStub, stepEnemyDepthInLaneDirection, advanceClimberTrackingColumnMin, writeScriptVariableToSlot, stepClimberSegmentGuarded,
  animateFlipperTurn, toggleEnemyTurnSide, spawnType5OnCoordMatch, jumpScriptCursorWhenFlagClear, setFlagIfSlotPastSegmentBound, advanceEnemyPursuit, fireHitOnPlayerCollision, steerSlotCoordinate, faceEnemyTowardPlayerSegment, setFlagFromPhaseAccumulatorSign,
];
export function dispatchSlotMotionHandler(m, a = m.regs.a, x = m.regs.x) {
  // The pre-doubled index a selects one of twenty handlers; the slot x rides in as an explicit arg.
  // a is also the seed Y for the two collision handlers' object-insert tail, so it is threaded as the
  // third arg (ignored by the other handlers).
  return TABLE[a >> 1](m, x, a);
}
