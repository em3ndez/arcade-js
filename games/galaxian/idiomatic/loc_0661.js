// SPDX-License-Identifier: GPL-3.0-only

// — the per-frame play/gameplay pipeline (an rst-0x28 sub-state
// dispatch target). It runs 27 subsystem updates in fixed order, then a three-part quiescence
// guard: only when no object/behaviour bit is live, the stage-advance side flag is set, and none of
// the moving-object sub-slots are active does it tick the sequence dwell timer, carrying
// into SEQUENCE_STATE on expiry. Memory-only live-out: the routine is reached by a
// tail-dispatch and rets into the NMI epilogue, which restores every register from the
// stack — no register it leaves is read back.
import {
  OBJ_ACTIVE_FLAG, SEQUENCE_STATE,
  loc_4201, loc_4208, loc_4225, loc_4260, loc_4009,
} from "./names.js";
import { moveControlledObjectAndStageSprite } from "./moveControlledObjectAndStageSprite.js";
import { advancePlayerShotAndStageSprite } from "./advancePlayerShotAndStageSprite.js";
import { advanceAndRenderProjectiles } from "./advanceAndRenderProjectiles.js";
import { loc_0cc3 } from "./loc_0cc3.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { armBehaviorGateOnInputOrTimer } from "./armBehaviorGateOnInputOrTimer.js";
import { flagPlayerShotHitOnFormation } from "./flagPlayerShotHitOnFormation.js";
import { flagProjectileHitsOnPlayer } from "./flagProjectileHitsOnPlayer.js";
import { flagPlayerShotHitsOnObjects } from "./flagPlayerShotHitsOnObjects.js";
import { flagObjectHitsOnPlayer } from "./flagObjectHitsOnPlayer.js";
import { clearGateOnPendingRequest } from "./clearGateOnPendingRequest.js";
import { spawnObjectsOnDelayedEvent } from "./spawnObjectsOnDelayedEvent.js";
import { launchAttackerFromFormation } from "./launchAttackerFromFormation.js";
import { chooseNextAttackerDirection } from "./chooseNextAttackerDirection.js";
import { rampCounterToCeiling } from "./rampCounterToCeiling.js";
import { handlePlayerHitEvent } from "./handlePlayerHitEvent.js";
import { driveGatedSoundStepSequence } from "./driveGatedSoundStepSequence.js";
import { driveDecayingSoundSweep } from "./driveDecayingSoundSweep.js";
import { paceEnemyLaunchTrigger } from "./paceEnemyLaunchTrigger.js";
import { scheduleDelayedEvent } from "./scheduleDelayedEvent.js";
import { fireDelayedEventRequest } from "./fireDelayedEventRequest.js";
import { selectAttackerRowScan } from "./selectAttackerRowScan.js";
import { armFormationAdvanceTrigger } from "./armFormationAdvanceTrigger.js";
import { advanceStageAndReseedFormation } from "./advanceStageAndReseedFormation.js";
import { driveSoundVoicesFromOccupancy } from "./driveSoundVoicesFromOccupancy.js";
import { expireActivityGatedTimer } from "./expireActivityGatedTimer.js";
import { computeControlledObjectMoveCommand } from "./computeControlledObjectMoveCommand.js";

export function loc_0661(m) {
  const { mem8 } = m;

  // 27 per-frame subsystem updates, in order.
  moveControlledObjectAndStageSprite(m);
  advancePlayerShotAndStageSprite(m);
  advanceAndRenderProjectiles(m);
  loc_0cc3(m);
  stageObjectsToSpriteShadow(m);
  armBehaviorGateOnInputOrTimer(m);
  flagPlayerShotHitOnFormation(m);
  flagProjectileHitsOnPlayer(m);
  flagPlayerShotHitsOnObjects(m);
  flagObjectHitsOnPlayer(m);
  clearGateOnPendingRequest(m);
  spawnObjectsOnDelayedEvent(m);
  launchAttackerFromFormation(m);
  chooseNextAttackerDirection(m);
  rampCounterToCeiling(m);
  handlePlayerHitEvent(m);
  driveGatedSoundStepSequence(m);
  driveDecayingSoundSweep(m);
  paceEnemyLaunchTrigger(m);
  scheduleDelayedEvent(m);
  fireDelayedEventRequest(m);
  selectAttackerRowScan(m);
  armFormationAdvanceTrigger(m);
  advanceStageAndReseedFormation(m);
  driveSoundVoicesFromOccupancy(m);
  expireActivityGatedTimer(m);
  computeControlledObjectMoveCommand(m);

  // Quiescence guard — bail unless the play field is idle this frame.
  // (1) no behaviour-gate / object-active bit0 is set ().
  if ((mem8[loc_4208] | mem8[loc_4201] | mem8[OBJ_ACTIVE_FLAG]) & 0x01) return;
  // (2) the stage-advance side flag bit0 must be set.
  if (!(mem8[loc_4225] & 0x01)) return;
  // (3) none of the 14 five-byte sub-slots based at may have bit0 set.
  let acc = 0;
  for (let i = 0; i < 14; i++) acc |= mem8[loc_4260 + 5 * i];
  if (acc & 0x01) return;

  // Tick the sequence dwell timer; on expiry carry into SEQUENCE_STATE.
  const decremented = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = decremented;
  if (decremented !== 0) return;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
}
