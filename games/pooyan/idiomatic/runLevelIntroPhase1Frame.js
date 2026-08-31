// SPDX-License-Identifier: GPL-3.0-only
import { runPhase1LauncherThenDriver } from "./runPhase1LauncherThenDriver.js";
import { sampleJoystickIntoPlayerAimState } from "./sampleJoystickIntoPlayerAimState.js";
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { advanceBonusAwardQueueAndBumpGauge } from "./advanceBonusAwardQueueAndBumpGauge.js";
import { pickEnemyGroupSpeedAndClearAim } from "./pickEnemyGroupSpeedAndClearAim.js";
import { scanActorCollisionsBothSlots } from "./scanActorCollisionsBothSlots.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";
import { tickHudRefresh } from "./tickHudRefresh.js";

/**
 * runLevelIntroPhase1Frame — level-intro phase-1 per-frame body: nine sub-passes in fixed order. The first is the
 * frame-tick + rst-0x28 gameplay dispatch; the rest are
 * the phase-1 spawner, joystick sampler, object-update gate, sprite rebuild, bonus tally, speed pick,
 * collision driver, and one sound-ring drain.
 *
 * LIVE-OUT: none — a void driver.
 */
export function runLevelIntroPhase1Frame(m) {
  tickHudRefresh(m);
  runPhase1LauncherThenDriver(m);
  sampleJoystickIntoPlayerAimState(m);
  dispatchPerFrameActorUpdatePasses(m);
  rebuildSpriteDisplayList(m);
  advanceBonusAwardQueueAndBumpGauge(m);
  pickEnemyGroupSpeedAndClearAim(m);
  scanActorCollisionsBothSlots(m);
  drainSoundCommandRing(m);
}
