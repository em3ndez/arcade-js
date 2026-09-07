// SPDX-License-Identifier: GPL-3.0-only
/**
 * runGameplayFrameAndAdvanceOnFieldClear — the per-frame play/gameplay pipeline.
 *
 * WHAT IT IS
 *   The heart of a live frame: it runs 27 gameplay subsystem updates in fixed ROM order — player/shot move
 *   and sprite staging, projectile integration, the object-AI loop, sprite staging, the collision flaggers,
 *   spawn/launch/pace logic, the sound drivers, and the stage advance/reseed — then applies a three-part
 *   quiescence guard. Only when the play field is idle this frame does it tick the sequence dwell timer and,
 *   on its zero-cross, carry into the next sequence state.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x0661, an rst-0x28 sub-state dispatch target reached from three state tables: the attract handler
 *   (SEQUENCE_STATE 15), runPlayerOnePlayFrame, and runPlayerTwoPlayFrame — so the same pipeline drives the
 *   demo and both players' turns. The quiescence guard is what advances a board once it has been cleared:
 *   it fires only when no object/behaviour bit is live (no bit0 in loc_4208 | loc_4201 | OBJ_ACTIVE_FLAG),
 *   the stage-advance side flag loc_4225 bit0 is set, and none of the 14 five-byte moving-object sub-slots
 *   based at loc_4260 have bit0 set; then it decrements the dwell timer loc_4009 and, on expiry, bumps
 *   SEQUENCE_STATE.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory only. The routine is reached by a tail-dispatch and rets into the NMI epilogue, which
 * restores every register from the stack — no register it leaves is read back.
 */
import {
  OBJ_ACTIVE_FLAG, SEQUENCE_STATE,
  loc_4201, loc_4208, loc_4225, loc_4260, loc_4009,
} from "./names.js";
import { moveControlledObjectAndStageSprite } from "./moveControlledObjectAndStageSprite.js";
import { advancePlayerShotAndStageSprite } from "./advancePlayerShotAndStageSprite.js";
import { advanceAndRenderProjectiles } from "./advanceAndRenderProjectiles.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
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

export function runGameplayFrameAndAdvanceOnFieldClear(m) {
  const { mem8 } = m;

  // 27 per-frame subsystem updates, in fixed ROM order. The order is load-bearing: e.g. positions are moved
  // and staged before the collision flaggers box-test them, and the spawn/launch logic runs after the AI.
  // Step the input/AI-controlled object one unit along its axis and stage its sprite.
  moveControlledObjectAndStageSprite(m);
  // Service the player shot and stage its two sprite render cells.
  advancePlayerShotAndStageSprite(m);
  // Integrate and render the moving-object (projectile) records at loc_4260.
  advanceAndRenderProjectiles(m);
  // Run the object-AI driver over all 8 object slots (SPRITE_SOURCE_OBJ_BASE, 32-byte stride).
  driveAllObjectSlots(m);
  // Render the 8 object records into the sprite-shadow area for this frame's DMA.
  stageObjectsToSpriteShadow(m);
  // Arm the behaviour gate (loc_4208) from input or the timer when the object subsystem is enabled.
  armBehaviorGateOnInputOrTimer(m);
  // Collision: player shot vs the standing formation (registers a formation alien kill).
  flagPlayerShotHitOnFormation(m);
  // Collision: enemy projectiles vs the player.
  flagProjectileHitsOnPlayer(m);
  // Collision: player shot vs the diving/object table.
  flagPlayerShotHitsOnObjects(m);
  // Collision: objects (divers) vs the player.
  flagObjectHitsOnPlayer(m);
  // Acknowledge and clear the behaviour gate when its pending request (loc_420b) is set.
  clearGateOnPendingRequest(m);
  // Spawn queued objects when the delayed-event request fires and the field allows it.
  spawnObjectsOnDelayedEvent(m);
  // Launch an attacker out of the formation (one-shot on the sub-counter refill flag).
  launchAttackerFromFormation(m);
  // Pick the next attacker's launch/curve direction from the formation anchor's sign.
  chooseNextAttackerDirection(m);
  // Step the slow pace/difficulty ramp counter toward its ceiling.
  rampCounterToCeiling(m);
  // Consume a raised player-hit event: kill the player, arm the hit sound and pace changes.
  handlePlayerHitEvent(m);
  // Tick the gated hit/step sound sequence (armed by the player-hit handler).
  driveGatedSoundStepSequence(m);
  // Tick the decaying sound sweep, fading it toward silence on alternate frames.
  driveDecayingSoundSweep(m);
  // Tick the enemy-launch pacing prescaler and refill expired attacker sub-counters.
  paceEnemyLaunchTrigger(m);
  // Arm the delayed-event triple when its guard conditions hold.
  scheduleDelayedEvent(m);
  // Fire the armed delayed-event one-shot when its countdown reaches zero.
  fireDelayedEventRequest(m);
  // Scan the row-occupancy table to select which formation row an attacker launches from.
  selectAttackerRowScan(m);
  // Arm the stage-advance one-shot when both status gates are set and it is not already armed.
  armFormationAdvanceTrigger(m);
  // On the armed stage-advance, rebuild the formation flag block and advance the stage.
  advanceStageAndReseedFormation(m);
  // Light the sound-write voices from the current formation occupancy (even frames).
  driveSoundVoicesFromOccupancy(m);
  // Tick the activity-gated timer while its arm flag and an activity gate are open.
  expireActivityGatedTimer(m);
  // Fold both object tables' position weights into the controlled-object move command (once per phase).
  computeControlledObjectMoveCommand(m);

  // Quiescence guard — advance the sequence only when the play field has fully cleared this frame.
  // (1) No behaviour-gate (loc_4208), hit-in-progress (loc_4201) or object-active (OBJ_ACTIVE_FLAG) bit0 set.
  if ((mem8[loc_4208] | mem8[loc_4201] | mem8[OBJ_ACTIVE_FLAG]) & 0x01) return;
  // (2) The stage-advance side flag (loc_4225) bit0 must be set.
  if (!(mem8[loc_4225] & 0x01)) return;
  // (3) None of the 14 five-byte moving-object sub-slots based at loc_4260 may have bit0 set.
  let acc = 0;
  for (let i = 0; i < 14; i++) acc |= mem8[loc_4260 + 5 * i];
  if (acc & 0x01) return;

  // Field is idle: tick the sequence dwell timer (loc_4009); on its zero-cross carry into SEQUENCE_STATE.
  const decremented = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = decremented;
  if (decremented !== 0) return;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
}
