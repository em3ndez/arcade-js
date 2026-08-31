// SPDX-License-Identifier: GPL-3.0-only
import { sampleJoystickIntoPlayerAimState } from "./sampleJoystickIntoPlayerAimState.js";
import { acquireTargetLockAndSetAimIndicator } from "./acquireTargetLockAndSetAimIndicator.js";
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { serviceEnemySpawns } from "./serviceEnemySpawns.js";
import { dispatchAllEnemyActorStates } from "./dispatchAllEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { advanceBonusAwardQueueAndBumpGauge } from "./advanceBonusAwardQueueAndBumpGauge.js";
import { pickEnemyGroupSpeedAndClearAim } from "./pickEnemyGroupSpeedAndClearAim.js";
import { runActorUpdatePipeline } from "./runActorUpdatePipeline.js";
import { armSirenAndTickWaveEventCountdown } from "./armSirenAndTickWaveEventCountdown.js";
import { drawStageLabelOncePerLevel } from "./drawStageLabelOncePerLevel.js";
import { promoteEnemyRecordsOnCountdownFire } from "./promoteEnemyRecordsOnCountdownFire.js";
import { tickIdleSirenAndTogglePhase } from "./tickIdleSirenAndTogglePhase.js";
/**
 * runActiveGameplayFrame — gameplay-state index-4 per-frame coordinator (dispatch-table entry 4).
 *
 * Runs fourteen per-frame sub-handlers in fixed order, then returns. Each is a balanced-wire
 * call (net SP 0) and each sub-handler reads its own state from RAM, so this driver marshals no
 * register and holds no live-out. All fourteen callees are lifted, so every call is dissolved.
 *
 * LIVE-OUT: none — a void coordinator; its dispatcher reads no register back.
 */
export function runActiveGameplayFrame(m) {
  sampleJoystickIntoPlayerAimState(m);
  acquireTargetLockAndSetAimIndicator(m);
  dispatchPerFrameActorUpdatePasses(m);
  serviceEnemySpawns(m);
  dispatchAllEnemyActorStates(m);
  dispatchFormationObjectStates(m);
  rebuildSpriteDisplayList(m);
  advanceBonusAwardQueueAndBumpGauge(m);
  pickEnemyGroupSpeedAndClearAim(m);
  runActorUpdatePipeline(m);
  armSirenAndTickWaveEventCountdown(m);
  drawStageLabelOncePerLevel(m);
  promoteEnemyRecordsOnCountdownFire(m);
  tickIdleSirenAndTogglePhase(m);
}
