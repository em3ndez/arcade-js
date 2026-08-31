// SPDX-License-Identifier: GPL-3.0-only
import { dispatchFormationPhaseOrQueueLaunchSlots } from "./dispatchFormationPhaseOrQueueLaunchSlots.js";
import { renderMarkerColumnExtendOrRetract } from "./renderMarkerColumnExtendOrRetract.js";
import { dispatchAllEnemyActorStates } from "./dispatchAllEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { advanceLeadActorSecondaryState } from "./advanceLeadActorSecondaryState.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
/**
 * stepGameplayFrame — gameplay-state per-frame coordinator.
 *
 * Runs six per-frame sub-drivers in fixed order, then returns. Every effect lands in memory (the
 * formation, the actor arena, the lead actor, the sprite display list); no register survives.
 *
 * LIVE-OUT: none — a void per-frame driver.
 */
export function stepGameplayFrame(m) {
  dispatchFormationPhaseOrQueueLaunchSlots(m); // formation manager
  renderMarkerColumnExtendOrRetract(m); // lift/marker column driver
  dispatchAllEnemyActorStates(m); // enemy-actor per-record state sweep
  dispatchFormationObjectStates(m); // formation-record object-state dispatch
  advanceLeadActorSecondaryState(m); // lead actor secondary state machine
  rebuildSpriteDisplayList(m); // sprite display-list rebuild
}
