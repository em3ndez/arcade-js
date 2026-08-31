// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ROUND_COUNTER,
  ENEMY_SPAWN_TIMER,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
  SPAWN_FACING_TABLE_1209,
  SPAWN_TIMER_TABLE_11F9,
  HUNTER_SPAWN_COUNT,
} from "./names.js";
/**
 * loc_119a — the per-record ENEMY-SPAWN INITIALISER. (ROM 0x119a-0x11f8. Grounding: [seen].)
 *
 * WHAT IT IS
 * ----------
 * The enemy world in Pooyan is a pool of fixed-layout ACTOR RECORDS — 0x18-byte blocks in work
 * RAM, based at ENEMY_ACTOR_TABLE (0x8ae0), one per on-screen enemy. New enemies are not born
 * from nothing; a slot is RECLAIMED. Each frame the game scans the pool for a record that is
 * currently empty (its header byte reads dormant) and, on the first empty one it meets, stamps in
 * the full opening state of a fresh actor. This routine is the stamper — the single door through
 * which an empty slot becomes a live enemy.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * It is a leaf called from the pool-scan loops, once per record visited:
 *   - the spawn-cadence tick (0x1171), which throttles spawning behind a countdown timer, and
 *   - the hunter slot sweep (0x118d), the bare scan that walks the records.
 * The caller hands it a record base and a Y-position seed. Because the routine bails immediately
 * on a record that is already live (see the guard below), the scan naturally slides past occupied
 * slots and lands its initialise on the first FREE one — then the return contract stops the scan,
 * so exactly one enemy appears per eligible frame.
 *
 * THE RETURN CONTRACT (why a boolean)
 * -----------------------------------
 * The value handed back drives the caller's scan:
 *   - true  — the record is already live, so nothing is done; the caller keeps scanning the pool.
 *   - false — this pass just seeded a free record; the caller must END its sweep here.
 * In the machine the "already live" case is a plain return, while the "seeded" case ends with a
 * stack-popping return that unwinds an extra call frame and returns one level ABOVE the immediate
 * caller — which is precisely what aborts the enclosing sweep after a single spawn. That double
 * unwind is what the `false` result stands in for.
 *
 * LIVE-OUT
 * --------
 * Memory only, plus the boolean above. Into the claimed record it writes: the liveness header, the
 * opening state index, the seeded Y, the cleared per-frame scratch fields, the facing byte and its
 * negation, and the animation stream (via setActorAnimation). Outside the record it reseeds the
 * enemy spawn-cadence timer (ENEMY_SPAWN_TIMER, 0x8d07) and bumps two tallies — the per-wave
 * ACTIVE_ENEMY_COUNT (0x8d40) budget and the never-reset cumulative HUNTER_SPAWN_COUNT (0x8f5f).
 * No register live-out: the frame driver that ultimately invokes this reads only the boolean.
 */

export function loc_119a(m, rec = m.regs.ix, posSeed = m.regs.e) {
  const { mem8 } = m;

  // LIVENESS GUARD (ROM 0x119a-0x11a1). The record's two-byte header at +0x00/+0x01 doubles as a
  // presence flag: OR the two bytes together and test bit 0. If bit 0 is set the slot is already
  // occupied by a live enemy, so leave it untouched and signal the caller to keep scanning. This
  // is what lets a caller start its scan at the top of the pool and have it settle on the first
  // genuinely empty slot.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) !== 0) return true; // already active -> keep scanning

  // STAMP THE OPENING STATE (ROM 0x11a3-0x11c2). The slot is free, so lay down a fresh actor.
  mem8[rec + 0x00] = 0x01; // +0x00 header -> 1: mark the record LIVE (odd header = present)
  mem8[rec + 0x02] = 0x03; // +0x02 state index -> 3: the actor's per-record state machine starts in its opening state
  mem8[rec + 0x04] = posSeed; // +0x04 Y coordinate: seeded from the caller (the spawn entry position)
  // Clear the per-frame scratch fields so the new actor carries no stale state from whatever
  // enemy last used this slot: +0x03 and +0x08 scratch, +0x05/+0x06 the fine/coarse position
  // countdown the mover advances each frame.
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  mem8[rec + 0x08] = 0x00;
  mem8[rec + 0x07] = 0x01; // +0x07 facing/animation-variant flag (bits 0,1 pick the anim/turn variant) -> variant 1
  mem8[rec + 0x0b] = 0x00; // +0x0b per-record animate-enable bit -> clear (this actor won't self-animate independently)

  // ROUND-TABLE INDEX (ROM 0x11c5-0x11cf, reused at 0x11e2-0x11eb). Both round-derived lookups
  // below share one index: take the round counter at ROUND_COUNTER (0x8907), keep its low six bits
  // and shift right twice, giving idx = (ROUND_COUNTER & 0x3f) >> 2. So the spawn's facing and its
  // cadence change in steps as the round advances.
  const idx = (mem8[ROUND_COUNTER] & 0x3f) >> 2;

  // FACING PAIR (ROM 0x11c5-0x11db). Look up the actor's facing byte in the round-indexed
  // SPAWN_FACING_TABLE_1209 (0x1209) and store it at +0x09; store its two's-complement negation at
  // +0x0a. The +0x09/+0x0a pair gives the mover the step delta and its opposite for this enemy's
  // travel direction. (The store into a byte cell takes the negation mod 256.)
  const facing = fetchByteFromTableIndex(m, SPAWN_FACING_TABLE_1209, idx)[0];
  mem8[rec + 0x09] = facing;
  mem8[rec + 0x0a] = -facing; // negated facing

  // ARM THE ANIMATION (ROM 0x11dc-0x11e1). Point the record's animation stream (+0x0c/+0x0d) at the
  // spawn animation-sequence table ANIM_TABLE_3829 (0x3829) and restart it at frame 0, so the fresh
  // enemy begins drawing its first frame.
  setActorAnimation(m, rec, ANIM_TABLE_3829);

  // RESEED THE SPAWN CADENCE (ROM 0x11e2-0x11ef). Reload the spawn-cadence countdown
  // ENEMY_SPAWN_TIMER (0x8d07) from the round-indexed SPAWN_TIMER_TABLE_11F9 (0x11f9). The cadence
  // tick drains this to zero before it will consider the next spawn, so this sets how long until
  // another enemy may appear — a value that tightens as the round climbs.
  mem8[ENEMY_SPAWN_TIMER] = fetchByteFromTableIndex(m, SPAWN_TIMER_TABLE_11F9, idx)[0];

  // BUMP THE TALLIES AND END THE SWEEP (ROM 0x11f2-0x11f8). Two counters advance in lock-step:
  // HUNTER_SPAWN_COUNT (0x8f5f) is the cumulative spawn-init total, never reset, and not read on
  // the spawn path; ACTIVE_ENEMY_COUNT (0x8d40) is the live-enemy count the cadence tick checks
  // against the per-stage budget. Returning false tells the caller this pass claimed a slot, ending its
  // sweep so only one enemy is born this pass.
  mem8[HUNTER_SPAWN_COUNT] = mem8[HUNTER_SPAWN_COUNT] + 1;
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;
  return false; // seeded a free record -> caller ends its sweep
}
