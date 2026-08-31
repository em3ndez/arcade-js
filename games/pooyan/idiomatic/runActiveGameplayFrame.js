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
 * runActiveGameplayFrame — the active-gameplay frame; ROM 0x18af-0x18d9.
 *
 * WHAT IT IS
 *   The per-frame handler for the round's main playing phase. Each frame the vblank
 *   heartbeat picks a top-level game state from MAIN_GAME_STATE (0x8805) through the jump
 *   table at ROM 0x06f0; the "play" state routes into the in-play sub-state dispatcher,
 *   which reads PLAY_STATE_INDEX (0x880a) masked to five bits and jumps through the table
 *   at ROM 0x15a8. This routine is entry 4 in that table — the state a round sits in for
 *   nearly its whole duration, once the arena has been built and the wave spawned.
 *
 * ITS ROLE IN THE MACHINE
 *   A fixed-order coordinator: it runs fourteen per-frame sub-handlers back to back and
 *   returns. The order is load-bearing — input is sampled first so the rest of the frame
 *   sees this frame's joystick; the actor state machines are stepped before the sprite
 *   list is rebuilt from them; the HUD and sound drivers close the frame. It passes no
 *   value between the sub-handlers: each reads and writes its own state directly in work
 *   RAM (the actor arena at ACTOR_TABLE 0x8a80, the counters in the live-state page at
 *   0x8900+, the sprite display list at SPRITE_DISPLAY_LIST 0x8840, the sound latches).
 *   It does NOT advance PLAY_STATE_INDEX itself; the round leaves active play only when a
 *   progression driver elsewhere (phase-gauge exhaustion, a player death, or the
 *   board-clear diversion BOARD_CLEAR_FLAG 0x89e5) rewrites the index.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void coordinator. It returns no value and leaves nothing in a
 *   register for its caller; all of its effects are the RAM/hardware writes performed by
 *   the fourteen sub-handlers it drives.
 */
export function runActiveGameplayFrame(m) {
  // 1. Player input (ROM 0x1e55). Sample the joystick into the player-actor state byte
  //    PLAYER_AIM_FLAGS (0x8a87): an abort/freeze condition zeros the byte, otherwise the
  //    complemented joystick is stored and its bit4 is rotated through a shift latch that
  //    gates clearing the byte's bit4. Runs first so every later step this frame reacts to
  //    the input just read. The player is slot 0 of the actor arena; the joystick drives
  //    its vertical position PLAYER_Y (0x8a84).
  sampleJoystickIntoPlayerAimState(m);
  // 2. Aim / target lock (ROM 0x6cab). Update the aiming indicator and target acquisition.
  //    Gated on GAME_ACTIVE_FLAG (0x8806), GRAB_ACTIVE_FLAG (0x8d32) and WAVE_TEARDOWN_STATE
  //    (0x8f24); steps the hit timer, bails on a proximity hit, then sets the above /
  //    on-target / below aim bits (bits 2/3 of PLAYER_AIM_FLAGS) by re-evaluating an
  //    existing lock or scanning the 6-block band for the closest enemy, recording the
  //    5-byte lock. Follows input so the indicator tracks where the joystick now points.
  acquireTargetLockAndSetAimIndicator(m);
  // 3. Object-update gate + helper chain (ROM 0x20d4). The gate that opens the per-frame
  //    object update, then its fixed helper chain. The whole object pass is suppressed while
  //    the board-clear diversion BOARD_CLEAR_FLAG (0x89e5) is set or a tamper freeze is
  //    latched, so the actor world only advances during genuine active play.
  dispatchPerFrameActorUpdatePasses(m);
  // 4. Enemy spawns (ROM 0x511b). The per-frame enemy-update dispatcher: run the enemy
  //    spawn-script sub-passes in order. This is what feeds the attack wave, draining the
  //    spawn cadence countdown ENEMY_SPAWN_TIMER (0x8d07) and pulling the board script to
  //    seed fresh enemy records.
  serviceEnemySpawns(m);
  // 5. Enemy actor states (ROM 0x3377). Walk the fourteen enemy actor records in the arena
  //    ACTOR_TABLE (0x8a80, stride 0x18) in order, running the per-record state dispatcher
  //    on each. Every live enemy advances its own state machine here — approach, dive,
  //    turn, fall — reading and rewriting its record in place.
  dispatchAllEnemyActorStates(m);
  // 6. Formation object states (ROM 0x40bd). Run the same object-state dispatcher over the
  //    four formation records at FORMATION_TABLE (0x8c30, stride 0x18), the grouped-attack
  //    objects that step independently of the individual enemies above.
  dispatchFormationObjectStates(m);
  // 7. Sprite list rebuild (ROM 0x02ef). Rebuild the sprite display list at
  //    SPRITE_DISPLAY_LIST (0x8840) from the just-advanced actor records — four record
  //    groups, an arrow Y-tick, and a flip-mirror tail. Runs after the state sweeps so the
  //    hardware picture reflects this frame's positions; the mirror tail honours the screen
  //    orientation flag FLIP_SCREEN_FLAG (0x881f).
  rebuildSpriteDisplayList(m);
  // 8. Bonus-award tally (ROM 0x18da). Step the pending bonus-award queue: reload the award
  //    queue when empty, otherwise gate on the active player's score MSB reaching the queued
  //    value, bump the saturating award gauge, BCD-step the queue, repaint the gauge and
  //    append the tally sound. The award schedule (queue reload 5/3, BCD step 8/7) is fixed
  //    at boot from BONUS_AWARD_DSW (0x8800).
  advanceBonusAwardQueueAndBumpGauge(m);
  // 9. Enemy group speed (ROM 0x191c). For a newly-formed target group (gated), choose the
  //    enemy speed/column value, commit it to SPEED_INDEX (0x8900) and clear the aim flags
  //    plus two adjacent cells. SPEED_INDEX escalates with the wave/round and, read clamped
  //    below 8, indexes the velocity magnitudes in ENEMY_SPEED_TABLE (0x148e).
  pickEnemyGroupSpeedAndClearAim(m);
  // 10. Master actor update (ROM 0x5ae4). The heavier per-frame actor updater — the second
  //     actor pass that drives movement and collision against the records touched above.
  runActorUpdatePipeline(m);
  // 11. Periodic siren / event countdown (ROM 0x196e). The gated periodic-event driver:
  //     tick the periodic-event timer PERIODIC_EVENT_TIMER (0x8d22) and, on expiry, reload
  //     it, set the wave-event latch WAVE_EVENT_LATCH (0x8d21) and fire the siren tile run.
  //     The mode is chosen off the per-round phase counter SPAWN_PHASE_COUNTER (0x8902).
  armSirenAndTickWaveEventCountdown(m);
  // 12. Stage-label HUD (ROM 0x1f2f). Paint the stage-label HUD, run once per level — the
  //     write is guarded so the label tiles are only re-stamped when the stage actually
  //     changes rather than every frame.
  drawStageLabelOncePerLevel(m);
  // 13. Deferred-object promotion (ROM 0x6b3b). On its countdown firing, promote in-range
  //     enemy records into the promoted-object list, queue that promotion's display commands,
  //     then rebuild the sprite list so the newly promoted objects appear this frame.
  promoteEnemyRecordsOnCountdownFire(m);
  // 14. Idle siren tick (ROM 0x19ca). Close the frame with the periodic warning-siren tick:
  //     a gated frame countdown that toggles a phase bit and queues one of two siren display
  //     commands, keeping the ambient siren cadence running through active play.
  tickIdleSirenAndTogglePhase(m);
}
