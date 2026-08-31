// SPDX-License-Identifier: GPL-3.0-only
import { advanceFirstGroupEnemyActorStates } from "./advanceFirstGroupEnemyActorStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { dispatchAllObjectStates } from "./dispatchAllObjectStates.js";
/**
 * runObjectAndEnemyActorUpdate — the per-frame update pass for the object world and the sprites
 * that draw it.
 *
 * WHAT IT IS
 *   ROM 0x76ea-0x76f3. Grounding: [seen].
 *   A tiny straight-line driver that runs three larger subsystems back to back, in a fixed order,
 *   and returns. It contains no logic of its own beyond that ordering — every branch, table, and
 *   coordinate lives inside the three routines it invokes. Think of it as the "advance one frame"
 *   entry point for everything that moves on the screen: spawned and launched objects, the enemy
 *   actors, and the sprite list that finally paints them.
 *
 * ROLE IN THE MACHINE
 *   Pooyan keeps the moving world in two conceptual halves. First there is *state*: flat arrays of
 *   fixed-size records, each holding one object's or actor's little state machine (where it is,
 *   what it is doing, how far along its animation it has crept). Second there is the *sprite
 *   display list*: a compact table the video hardware actually reads to draw. This driver bridges
 *   the two once per frame. It advances the state records first, then restages the display list
 *   from the freshly-advanced records — so the pixels drawn this frame reflect the state as of this
 *   frame, never a frame stale. The three steps below MUST run in this order for that to hold.
 *
 * THE THREE STEPS, IN ORDER
 *   1. Object-state sweep      (dispatchAllObjectStates, 0x76f4)
 *   2. Enemy-actor animation   (advanceFirstGroupEnemyActorStates, 0x7625)
 *   3. Sprite-list rebuild     (rebuildSpriteDisplayList, 0x02ef)
 *
 * LIVE-OUT (what it leaves in memory for the caller to read back)
 *   - The six object-state records at OBJECT_STATE_RECORD_BASE (0x8ba0, stride 0x18, running on
 *     into the projectile table at 0x8be8) each advanced by one frame.
 *   - The enemy-actor animation counters in ENEMY_ACTOR_TABLE (0x8ae0) ticked for the first group
 *     of records.
 *   - The sprite display list at SPRITE_DISPLAY_LIST (0x8840) rebuilt to match that new state.
 *   Nothing is returned in a register — this is a pure sequencer, and the caller reads its result
 *   entirely out of the memory the three steps touched.
 */
export function runObjectAndEnemyActorUpdate(m) {
  // STEP 1 — Advance the object-state table (0x76f4).
  // Walks the six fixed-size records of the object-state array based at OBJECT_STATE_RECORD_BASE
  // (0x8ba0), stride 0x18, handing each to the per-object state dispatcher so its little state
  // machine takes one frame's step. Because the array is deliberately laid out to spill into
  // PROJECTILE_TABLE (0x8be8), the same pass also ticks the projectile records: everything spawned
  // or launched in this pool gets its single beat of life here. Positions and states are current
  // AFTER this step, which is why it runs before the display list is rebuilt.
  dispatchAllObjectStates(m); // advance the object state table (record-walk dispatcher)
  // STEP 2 — Tick the enemy-actor animation walk, first group (0x7625).
  // This entry seeds a record count of 8 and runs the shared per-frame animation walk over the
  // enemy-actor pool at ENEMY_ACTOR_TABLE (0x8ae0), nudging each covered record's animation timers
  // and frame counters forward. It advances how the enemy actors *look* over time; their higher-
  // level movement/state was already stepped in the state sweeps upstream of this driver.
  advanceFirstGroupEnemyActorStates(m);
  // STEP 3 — Rebuild the sprite display list (0x02ef).
  // The video hardware draws from a flat table of four-byte sprite entries, but the game reasons
  // about objects in wide, scattered game-logic records. This step restages the whole sprite
  // display list at SPRITE_DISPLAY_LIST (0x8840) from those records — four record groups, the
  // arrow's Y-tick, and the flip-mirror tail — so the newly-advanced state from steps 1 and 2 is
  // reflected in what gets painted this frame. Running last guarantees the drawn frame is fresh.
  rebuildSpriteDisplayList(m);
}
