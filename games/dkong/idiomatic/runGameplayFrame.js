// SPDX-License-Identifier: GPL-3.0-only
/**
 * runGameplayFrame — one frame of play: run the frame's subsystem updates in a fixed order, then,
 * if Mario stopped being active during them, hand the game over to the death sub-state.
 *
 * Twenty-four updates run in sequence with no data passed between them — every one of them reads
 * and writes work RAM and returns nothing this routine looks at. What this routine contributes is
 * the ORDER, three gates that can abandon the rest of the frame, and the death hand-off at the
 * end, which adds two more calls on that arm only. The three gates, each a callee whose `false`
 * means "this frame's remaining gameplay update is off": the effect-latch gate (an effect is
 * playing, so the frame belongs to it), the board-won check (the board was won and the win path
 * already committed the advance), and the bonus-expired step machine (its last step takes the
 * death exit once Mario is grounded). All three resume exactly where an ordinary return resumes,
 * so all three are a plain `return` here and this routine is NOT itself caller-skip-capable.
 *
 * THE TAIL IS THE DEATH HAND-OFF. Mario can be alive at entry and dead by the time the updates
 * finish — the object-collision and hazard updates above are what kill him. So the last act reads
 * MARIO_ACTIVE: still active, and the frame is simply over; zero, and the routine silences every
 * sound output, fires the death sound trigger, and steps the sub-state on.
 *
 * WHAT THE NAME RESTS ON, from this body alone: nothing in the sequence is specific to a board, a
 * mode or a screen — it is the subsystem updates plus the death exit, which is what one frame of
 * play consists of. The name says FRAME rather than cascade because the fixed order and the
 * abandon gates are what the routine is for.
 *
 * Reads MARIO_ACTIVE; writes the death sound trigger. Every other cell it affects, it affects
 * through a callee.
 *
 * LIVE-OUT: memory-only; returns undefined on every arm.
 */

import { MARIO_ACTIVE, SND_TRIGGER } from "./names.js";

import { dispatchEffectState } from "./dispatchEffectState.js";
import { runHitEffectInsteadOfPlay } from "./runHitEffectInsteadOfPlay.js";
import { dispatchMarioMovement } from "./dispatchMarioMovement.js";
import { driveBarrelRelease } from "./driveBarrelRelease.js";
import { scheduleBarrelRelease } from "./scheduleBarrelRelease.js";
import { updateFires } from "./updateFires.js";
import { update75mActorObjects } from "./update75mActorObjects.js";
import { update50mMovingObjects } from "./update50mMovingObjects.js";
import { raisePeriodicObjectSpawnRequests } from "./raisePeriodicObjectSpawnRequests.js";
import { driveHammerSprite } from "./driveHammerSprite.js";
import { dispatch50mObjectState } from "./dispatch50mObjectState.js";
import { collectEdgeRivet } from "./collectEdgeRivet.js";
import { startMarioFallWhenGroundGivesWay } from "./startMarioFallWhenGroundGivesWay.js";
import { beginMarioFall } from "./beginMarioFall.js";
import { service75mBoard } from "./service75mBoard.js";
import { update50mConveyorObjects } from "./update50mConveyorObjects.js";
import { scanObjectsAtMarioX } from "./scanObjectsAtMarioX.js";
import { slide50mSpriteRowAndServiceColorCycle } from "./slide50mSpriteRowAndServiceColorCycle.js";
import { killMarioOnObjectCollision } from "./killMarioOnObjectCollision.js";
import { recordHammerHitOnObject } from "./recordHammerHitOnObject.js";
import { checkBoardWonByType } from "./checkBoardWonByType.js";
import { dispatchBonusExpiredStep } from "./dispatchBonusExpiredStep.js";
import { tickTimedBoardBonus } from "./tickTimedBoardBonus.js";
import { silenceSound } from "./silenceSound.js";
import { advanceSubstateAndArmTimer } from "./advanceSubstateAndArmTimer.js";

/** The return bracket the object-slot walk's own `ret` pops. */
const RESUME_AFTER_OBJECT_DISPATCH = 0x1986;

/** Sound trigger 2, held asserted for three frames — the count every writer of this array uses. */
const DEATH_SOUND_TRIGGER = SND_TRIGGER + 2;
const TRIGGER_FRAMES = 3;

/**
 * @param {object} m  the machine. No register live-in: both entries reach here from a
 *   sub-state dispatch, and every callee loads its own state.
 * @returns {void}  on every arm — a boolean here would make the call seam treat this routine
 *   as caller-skip-capable and discard a stack word it does not owe.
 */
export function runGameplayFrame(m) {
  const { mem8 } = m;

  dispatchEffectState(m);

  // An effect is playing: this frame belongs to it and the rest of the update is off.
  if (!runHitEffectInsteadOfPlay(m)) return;

  dispatchMarioMovement(m);

  // The object-slot walk and its shared sprite tail, dispatched by address: it returns through
  // its own `ret`, so the bracket that `ret` pops is pushed here as part of the call.
  m.push16(RESUME_AFTER_OBJECT_DISPATCH);
  m.call(0x1f72);

  driveBarrelRelease(m);
  scheduleBarrelRelease(m);
  updateFires(m);
  update75mActorObjects(m);
  update50mMovingObjects(m);
  raisePeriodicObjectSpawnRequests(m);
  driveHammerSprite(m);
  dispatch50mObjectState(m);
  collectEdgeRivet(m);
  startMarioFallWhenGroundGivesWay(m);
  beginMarioFall(m);
  service75mBoard(m);
  update50mConveyorObjects(m);
  scanObjectsAtMarioX(m);
  slide50mSpriteRowAndServiceColorCycle(m);
  killMarioOnObjectCollision(m);
  recordHammerHitOnObject(m);

  // The board was won: the win path has already stamped it and committed the board advance,
  // so nothing after this point should run for this frame.
  if (!checkBoardWonByType(m)) return;

  // The bonus-expired machine took its death exit (it only can once Mario is grounded), which
  // has already stepped the sub-state.
  if (!dispatchBonusExpiredStep(m)) return;

  tickTimedBoardBonus(m);


  // Still active — the frame is simply over. Mario can have died anywhere above.
  if (mem8[MARIO_ACTIVE] !== 0) return;

  // He did not survive the frame: cut every sound off, fire the death trigger, and step the
  // sub-state on to the death-animation router.
  silenceSound(m);
  mem8[DEATH_SOUND_TRIGGER] = TRIGGER_FRAMES;
  return advanceSubstateAndArmTimer(m);
}
