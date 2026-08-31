// SPDX-License-Identifier: GPL-3.0-only
import { advanceEnemyActorStateWalk } from "./advanceEnemyActorStateWalk.js";

// ENTRY_COUNT is how many enemy-actor records this entry point sweeps: 0x0e = 14, the whole
// enemy-actor pool. The records live in a packed array at ENEMY_ACTOR_TABLE (0x8ae0), each a fixed
// 0x18 (24) bytes, and 14 of them (0x0e * 0x18 = 0x150 bytes) span the full run of enemy attackers
// that make up a wave. The machine carries this count in register B, seeded here before the shared
// walk begins; the sibling entry that starts the walk seeds 8 instead to cover only the first group.
const ENTRY_COUNT = 0x0e; // records this twin entry ticks

/**
 * advanceAllEnemyActorStates — full-pool entry to the shared enemy-actor animation-tick walk.
 *
 * WHAT IT IS
 *   ROM 0x7621-0x7625. Grounding: [seen].
 *   One of two twin entry points into the shared per-frame enemy-actor animation walk. Both entries
 *   run the identical body; they differ only in the record count they seed before dropping into it.
 *   This entry seeds 14 (0x0e) — the whole enemy-actor pool — while the sibling entry
 *   (advanceFirstGroupEnemyActorStates, ROM 0x7625) seeds 8 to touch only the first group. Sharing
 *   one body keeps the animation logic in a single place; the entry chosen by the caller decides
 *   how far across the pool that logic reaches this frame.
 *
 * ROLE IN THE MACHINE
 *   Once per frame the game nudges the animation state of its enemy actors — the attackers that
 *   climb, gather and dive during a wave. This entry hands the full count to the shared walk
 *   (advanceEnemyActorStateWalk, ROM 0x7627), which starts a cursor at ENEMY_ACTOR_TABLE (0x8ae0)
 *   and steps it by the 0x18 record stride, handing each of the 14 records to the per-entry
 *   animation tick. That tick dispatches on the record's state byte and advances its animation
 *   frame; at certain phase boundaries a tick performs a group reseed of the shared enemy state and
 *   signals the walk to abandon the rest of this frame's pass (the later records would only be
 *   ticked from state that was just rewritten). The walk resumes cleanly from the new phase next
 *   frame.
 *
 * LIVE-OUT
 *   None. This is a void delegator: it seeds the count and runs the walk, returning nothing. All
 *   effect is in memory — the walk's per-entry tick mutates the enemy-actor records (frame counters
 *   and state bytes) and the shared phase countdown / phase latches it reseeds. The caller reads no
 *   value back.
 */
export function advanceAllEnemyActorStates(m) {
  // Seed the full-pool count (14) and run the shared animation-tick walk over ENEMY_ACTOR_TABLE
  // (0x8ae0). The walk owns the cursor, the 0x18 stride and the early-abort-on-reseed behaviour;
  // this entry's only job is to fix how many records that walk covers.
  advanceEnemyActorStateWalk(m, ENTRY_COUNT);
}
