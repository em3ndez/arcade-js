// SPDX-License-Identifier: GPL-3.0-only
import { advanceEnemyActorStateWalk } from "./advanceEnemyActorStateWalk.js";

// ENTRY_COUNT is the number of enemy-actor records this entry point ticks: the first group of 8.
// In the machine this is `ld b,0x08` at ROM 0x7625 — register B carries the record count into the
// shared walk body, which loops that many times. The companion entry advanceAllEnemyActorStates
// (0x7621) seeds 14 instead; the two differ only in this count.
const ENTRY_COUNT = 0x08; // records this twin entry ticks

/**
 * advanceFirstGroupEnemyActorStates — twin entry to the shared animation-tick walk.
 *
 * WHAT IT IS
 *   ROM 0x7625. Grounding: [seen].
 *   One of two entry points that front the shared per-frame enemy-actor animation walk
 *   (advanceEnemyActorStateWalk, 0x7627). This entry covers the FIRST GROUP — 8 records — of the
 *   enemy-actor pool. In the machine it is `ld b,0x08` (0x7625) followed by a fall-through into the
 *   shared body at 0x7627: the same body that advanceAllEnemyActorStates (0x7621) reaches after
 *   seeding a count of 14. The only difference between the two entries is the count they hand in.
 *
 * ROLE IN THE MACHINE
 *   Once per frame the game nudges the animation state of its enemy actors — the attackers that make
 *   up a wave. Calling here runs the shared walk over the first 8 records of the enemy-actor table
 *   (ENEMY_ACTOR_TABLE = 0x8ae0), stride 0x18, handing each record in turn to the per-entry
 *   animation tick at 0x7638. That tick dispatches on the record's state byte and advances the
 *   record's animation frame; at certain phase boundaries a state handler instead performs a group
 *   reseed of the shared enemy state and asks the walk to stop. When that happens the shared walk
 *   aborts immediately, leaving the records it has not yet reached untouched this frame — the reseed
 *   has already rewritten the shared state those later records would tick from, so the sweep simply
 *   resumes from the new phase on the next frame.
 *
 * LIVE-OUT
 *   None — a void delegator. All effect is in memory, produced by the shared walk: the per-entry
 *   tick mutates the enemy-actor records (frame counters and state bytes) plus the shared phase
 *   countdown / phase latches it reseeds. The caller reads nothing back.
 */
export function advanceFirstGroupEnemyActorStates(m) {
  // Seed the count (8) and run the shared per-frame animation-tick walk over the first group of
  // enemy-actor records. This mirrors the machine's `ld b,0x08` / fall-into-0x7627 sequence: the
  // count sets how many records the walk sweeps at ENEMY_ACTOR_TABLE (0x8ae0, stride 0x18) before it
  // finishes — or fewer, if a per-entry tick signals a phase-transition reseed and aborts the walk.
  advanceEnemyActorStateWalk(m, ENTRY_COUNT);
}
