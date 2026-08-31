// SPDX-License-Identifier: GPL-3.0-only
import { tickHudRefresh } from "./tickHudRefresh.js";
import { generatePlayerControlInput } from "./generatePlayerControlInput.js";
import { advanceToPhaseCompleteOnStageEnd } from "./advanceToPhaseCompleteOnStageEnd.js";
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { serviceEnemySpawns } from "./serviceEnemySpawns.js";
import { stepEnemyActorStates } from "./stepEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { runActorUpdatePipeline } from "./runActorUpdatePipeline.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";

/**
 * runActivePlayFrame — the active-play sub-state handler: run one frame's ten subsystem updates in order.
 *
 * HUD refresh, lead-actor input read, sub-state advance, object-update gate, enemy spawns,
 * enemy-record state sweep, formation state dispatch, sprite display-list rebuild, actor pipeline,
 * and finally drain one sound-command. Each step reads and mutates shared memory.
 *
 * LIVE-OUT: memory only — every effect is a side effect of the ten callees. No register output.
 */

export function runActivePlayFrame(m) {
  tickHudRefresh(m);
  generatePlayerControlInput(m);
  advanceToPhaseCompleteOnStageEnd(m);
  dispatchPerFrameActorUpdatePasses(m);
  serviceEnemySpawns(m);
  stepEnemyActorStates(m);
  dispatchFormationObjectStates(m);
  rebuildSpriteDisplayList(m);
  runActorUpdatePipeline(m);
  drainSoundCommandRing(m);
}
