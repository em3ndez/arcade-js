// SPDX-License-Identifier: GPL-3.0-only
import { dispatchFormationPhaseOrQueueLaunchSlots } from "./dispatchFormationPhaseOrQueueLaunchSlots.js";
import { renderMarkerColumnExtendOrRetract } from "./renderMarkerColumnExtendOrRetract.js";
import { dispatchAllEnemyActorStates } from "./dispatchAllEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { advanceLeadActorSecondaryState } from "./advanceLeadActorSecondaryState.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
/**
 * stepGameplayFrame -- gameplay-state per-frame coordinator.
 *
 * WHAT IT IS
 * ----------
 * One frame of active play, in its leaner form. The in-play machine keeps a sub-state
 * index in PLAY_STATE_INDEX (0x880a); each frame that index is masked to five bits and
 * used to pick one handler out of the jump table at ROM 0x15a8. This routine is the
 * handler for index 5 -- the alternate active-play frame, a trimmed sibling of the
 * fourteen-driver index-4 frame (runActiveGameplayFrame). It does not decide when the
 * round is over: it never rewrites PLAY_STATE_INDEX itself, so play stays on this index
 * until some other progression driver (the phase gauge draining, a death, or the
 * board-clear diversion) moves the index elsewhere.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * A fixed-order coordinator. It advances the whole gameplay world for one frame by
 * running six sub-drivers back to back, in a set order that matters: the formation and
 * playfield are updated first, then the actors, then the lead actor's secondary state,
 * and only last is the on-screen sprite list rebuilt from whatever those drivers left
 * behind. Nothing here reads a sub-driver's result -- each one works entirely through
 * shared work RAM (the actor arena at ACTOR_TABLE 0x8a80, the formation records at
 * FORMATION_TABLE 0x8c30, the launch/formation state cells, and the sprite display list
 * at SPRITE_DISPLAY_LIST 0x8840).
 *
 * ROM: 0x19ee-0x1a00.
 * Grounding: [seen]
 *
 * LIVE-OUT: none -- a void per-frame driver. Every effect lands in memory (the enemy
 * formation, the actor arena, the lead actor, the sprite display list); no result is
 * returned to the caller.
 */
export function stepGameplayFrame(m) {
  // Step 1 -- the enemy-formation manager (ROM 0x308b).
  // While no formation is active this does nothing. Once a formation is running it reads
  // the formation launch state (FORMATION_STATE 0x8f08), takes its low two bits less one
  // as a phase index, and runs the matching formation-phase handler followed by the
  // shared epilogue. When no formation is running instead, it scans the actor records for
  // launch-ready slots and registers each one into the four-entry slot table at the base
  // of FORMATION_SLOT_TABLE (0x8920), marking it queued; the fourth entry filling the
  // table arms the formation, and a scan that finds none resets the slot-table head.
  dispatchFormationPhaseOrQueueLaunchSlots(m); // formation manager
  // Step 2 -- the lift / marker column (ROM 0x25a6).
  // Draws the vertical lift/marker column into video RAM at the current layout write
  // pointer, extending or retracting it one cell this frame so the column grows and
  // shrinks on screen as play advances.
  renderMarkerColumnExtendOrRetract(m); // lift/marker column driver
  // Step 3 -- the enemy actor-state sweep (ROM 0x3377).
  // Walks the fourteen enemy actor records in the arena at ACTOR_TABLE (0x8a80, stride
  // 0x18) in order, handing each record in turn to the per-record state dispatcher. That
  // dispatcher advances one enemy's position/animation/AI for the frame off the record's
  // own state byte, so the whole enemy population is stepped once per frame here.
  dispatchAllEnemyActorStates(m); // enemy-actor per-record state sweep
  // Step 4 -- the formation object-state sweep (ROM 0x40bd).
  // Runs the object-state dispatcher over the four formation records at FORMATION_TABLE
  // (0x8c30, stride 0x18): the enemies flying in formation are stepped separately from the
  // free enemy actors of step 3, each formation record advanced by its own state byte.
  dispatchFormationObjectStates(m); // formation-record object-state dispatch
  // Step 5 -- the lead actor's secondary state machine (ROM 0x28c6).
  // Slot 0 of the arena is the player/lead actor; alongside its primary state it carries a
  // secondary state (driven off LEAD_ACTOR_STATE 0x8a82 and the slot-0 fields). This driver
  // advances that secondary state machine for the frame -- the lead actor's follow-on
  // motions layered on top of whatever the main actor step set up.
  advanceLeadActorSecondaryState(m); // lead actor secondary state machine
  // Step 6 -- rebuild the sprite display list (ROM 0x02ef).
  // Last, because it consumes everything the drivers above wrote. It rebuilds the hardware
  // sprite display list at SPRITE_DISPLAY_LIST (0x8840) from the live actor records -- four
  // record groups plus the arrow Y-tick -- and runs the flip-mirror tail so the on-screen
  // sprites reflect this frame's world state before the next vblank latches them.
  rebuildSpriteDisplayList(m); // sprite display-list rebuild
}
