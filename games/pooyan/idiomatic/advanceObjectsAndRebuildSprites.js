// SPDX-License-Identifier: GPL-3.0-only

// The four per-frame passes this tail runs, in the exact order the machine runs them.
// Each is a self-contained subsystem update; this routine owns none of their logic and
// only sequences them.
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
import { stepEnemyActorStates } from "./stepEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * advanceObjectsAndRebuildSprites — the play loop's shared post-handler tail.
 *
 * WHAT IT IS
 *   A fixed four-pass sequence that advances every on-screen object by one frame and then
 *   restages the sprite display list from the freshly-updated object records. It runs the
 *   three object-advancing passes first (the two target actors, the fourteen enemy-actor
 *   records, the four formation objects) and the display-list rebuild last, so the picture
 *   the raster scans reflects this frame's motion rather than the previous frame's.
 *
 * ROLE IN THE MACHINE
 *   The ordinary play loop is a six-way sub-state machine. Its two "worker" sub-states run
 *   the full per-frame subsystem chain themselves. The other four sub-states are a one-way
 *   script of timers that stage the bonus / round-transition choreography — each is little
 *   more than a countdown that, on expiry, marches the machine to the next sub-state. If
 *   those scripted states did only their own work, the objects would freeze and the screen
 *   would stop refreshing while the timers drained. To prevent that, the sub-state
 *   dispatcher runs THIS tail after each of those timer/HUD handlers finishes. That is why
 *   the game keeps animating objects and refreshing the sprite list even during the
 *   scripted countdown states whose own handler bodies do almost nothing but tick.
 *
 * ROM 0x1035-0x1041.
 * Grounding: [seen].
 *
 * LIVE-OUT: memory only — whatever the four passes write into the object-record banks and
 *   the sprite display list. No register output.
 */
export function advanceObjectsAndRebuildSprites(m) {
  // Pass 1 — the target-actor step (ROM 0x2157). Advances the two player-launched "target
  // actor" records that ride the field (based at ENEMY_TARGET_REC0, 0x8c90): each occupied
  // record is moved, timed down, and torn down when spent, and the pass closes with the
  // shared animation-script integrity check. Runs first so a target that dies this frame is
  // already gone before the display list is built.
  stepActiveTargetActorRecords(m);

  // Pass 2 — the per-object enemy state sweep (ROM 0x1219). Visits the fourteen enemy-actor
  // records (stride 0x18 from ENEMY_ACTOR_TABLE, 0x8ae0) and runs exactly one step of each
  // record's own state machine — climb, hold, turn, dive, fall, be-caught, and so on. The
  // fourteen-record span deliberately overruns the enemy slots into the neighbouring object
  // pools, which expose their state byte at the same record offset.
  stepEnemyActorStates(m);

  // Pass 3 — the formation-state dispatch (ROM 0x40bd). Walks the four formation-object
  // records (stride 0x18 from FORMATION_TABLE, 0x8c30) — the squadron that gathers, holds
  // together, then peels off to attack — and advances each by one step of its state machine.
  dispatchFormationObjectStates(m);

  // Pass 4 — the sprite display-list rebuild (ROM 0x02ef). Harvests all the now-updated,
  // scattered game-logic records into the one contiguous, hardware-shaped 24-entry, stride-4
  // sprite display list at SPRITE_DISPLAY_LIST (0x8840) that a later step copies to the
  // sprite banks, then applies the arrow-Y nudge and the cabinet-orientation flip-mirror
  // tail. Runs last so it captures every position and state change the three passes above
  // made this frame.
  rebuildSpriteDisplayList(m);
}
