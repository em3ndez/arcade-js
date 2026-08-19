// SPDX-License-Identifier: GPL-3.0-only
// runGameplayFrame — one frame of play: run the subsystem updates in a fixed order behind three
// abandon-gates (effect playing / board won / bonus-expired death exit), then hand off to the death
// sub-state if Mario went inactive. Memory-only; returns void on every arm -- a boolean would make
// the call seam treat this as caller-skip-capable and drop a stack word it does not owe.

import { MARIO_ACTIVE, SND_TRIGGER } from "./names.js";

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

const RESUME_AFTER_OBJECT_DISPATCH = 0x1986; // the bracket the object-slot walk's own `ret` pops
const EFFECT_STATE_MACHINE = 0x1dbd; // + RESUME below: the bracket the effect handlers' `ret` pops
const RESUME_AFTER_EFFECT_DISPATCH = 0x197d;
const DEATH_SOUND_TRIGGER = SND_TRIGGER + 2; // held 3 frames, the count every writer of this array uses
const TRIGGER_FRAMES = 3;

export function runGameplayFrame(m) {
  const { mem8 } = m;

  // Dispatch the effect-sprite state machine by address, as the object-slot walk below is: its
  // arm/countdown handlers return through a guest `ret`, so the bracket that `ret` pops is pushed
  // here (a plain call left it popping a live interrupt-frame word -- the "jump over a barrel" reset).
  m.push16(RESUME_AFTER_EFFECT_DISPATCH);
  m.call(EFFECT_STATE_MACHINE);

  if (!runHitEffectInsteadOfPlay(m)) return; // an effect is playing: the frame belongs to it

  dispatchMarioMovement(m);

  // Object-slot walk + shared sprite tail, dispatched by address (returns through its own `ret`).
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

  if (!checkBoardWonByType(m)) return; // board won: the win path already committed the advance
  if (!dispatchBonusExpiredStep(m)) return; // bonus-expired machine took its death exit (Mario grounded)

  tickTimedBoardBonus(m);

  if (mem8[MARIO_ACTIVE] !== 0) return; // still active -- the frame is simply over

  // Died this frame: cut sound, fire the death trigger, step the sub-state to the death router.
  silenceSound(m);
  mem8[DEATH_SOUND_TRIGGER] = TRIGGER_FRAMES;
  return advanceSubstateAndArmTimer(m);
}
