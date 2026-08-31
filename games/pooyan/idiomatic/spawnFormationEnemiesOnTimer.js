// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { seedFirstFreeSlotForTimedSpawnWithTamperCheck } from "./seedFirstFreeSlotForTimedSpawnWithTamperCheck.js";
import {
  SPAWN_RELOAD_TIMER,
  SPAWN_TIMER_RELOAD_TABLE,
  SPAWN_SEQUENCE_INDEX_8D14,
  FORMATION_SPAWN_TABLE,
  ROUND_COUNTER,
  DIFFICULTY_DSW,
} from "./names.js";
/**
 * spawnFormationEnemiesOnTimer — frame-timer gated formation spawner.
 *
 * WHAT IT IS
 *   The metronome that drips formation enemies into the arena. It runs once per frame during active
 *   play, but it does real work only on a "beat": a countdown timer ticks down every frame, and only
 *   when it reaches zero does the routine reload the timer, decide how many enemies to try to place
 *   this beat, and hand the work to the slot-seeding loop. Between beats it does nothing but tick.
 *
 * ROLE IN THE MACHINE
 *   This is the pacing layer of enemy production. It does not itself write actor records — it owns the
 *   *schedule* (how often a spawn attempt happens) and the *quota* (how many slots to fill on this
 *   attempt), then tails into seedFirstFreeSlotForTimedSpawnWithTamperCheck, which walks the formation
 *   record table and actually seeds the free slots. The interval between beats is not constant: it is
 *   drawn from a 16-entry ROM table via a rotating cursor, so the cadence cycles through the table.
 *   The quota rises with progress — later rounds (and harder difficulty settings) push out more enemies
 *   per beat.
 *
 * ROM ADDRESS
 *   0x5564-0x5592.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   Void — the routine returns nothing. Its whole effect lives in memory it leaves behind:
 *     - SPAWN_RELOAD_TIMER (0x8d06): either decremented by one, or reloaded from the ROM table.
 *     - SPAWN_SEQUENCE_INDEX_8D14 (0x8d14): the rotating cursor, advanced by one on a beat.
 *     - FORMATION_SPAWN_TABLE (0x8c60): whatever formation slots the seeding tail fills this beat.
 */
const BLOCK_STRIDE = 0x18; // actor-record stride the scan/seed tail walks: records sit 0x18 bytes apart in FORMATION_SPAWN_TABLE

export function spawnFormationEnemiesOnTimer(m) {
  const { mem8 } = m;

  // STEP 1 — tick the beat timer (SPAWN_RELOAD_TIMER, 0x8d06).
  // Every frame the countdown drops by one. The store is byte-wide RAM, so the subtraction wraps
  // within 8 bits (0x00 - 1 -> 0xff). While the timer has not hit zero the beat has not arrived, so
  // the spawner bows out for this frame and leaves everything else untouched.
  mem8[SPAWN_RELOAD_TIMER] = mem8[SPAWN_RELOAD_TIMER] - 1; // mem8 write truncates to 8 bits
  if (mem8[SPAWN_RELOAD_TIMER] !== 0) return; // timer still running

  // STEP 2 — beat arrived: reload the timer for the next interval.
  // The gap until the next beat is not fixed. The low nibble of the rotating cursor
  // (SPAWN_SEQUENCE_INDEX_8D14, 0x8d14) selects one of 16 entries in the ROM reload table
  // SPAWN_TIMER_RELOAD_TABLE (0x560f); that byte becomes the new countdown value in 0x8d06. Since the
  // cursor advances every beat (STEP 3), successive intervals march through the table's 16 slots.
  const idx = mem8[SPAWN_SEQUENCE_INDEX_8D14] & 0x0f;
  const [reload] = fetchByteFromTableIndex(m, SPAWN_TIMER_RELOAD_TABLE, idx); // rst-20 table fetch: A := table[idx]
  mem8[SPAWN_RELOAD_TIMER] = reload;

  // STEP 3 — advance the rotating spawn cursor (0x8d14).
  // Bumping the cursor moves both the reload-table index (STEP 2, masked to its low nibble) forward,
  // so the next beat reads the next schedule entry.
  mem8[SPAWN_SEQUENCE_INDEX_8D14] = mem8[SPAWN_SEQUENCE_INDEX_8D14] + 1;

  // STEP 4 — choose how many slots to try to seed on this beat.
  let count;
  if (mem8[ROUND_COUNTER] >= 0x04) {
    // From round 4 onward (ROUND_COUNTER, 0x8907) the quota is always two: deep rounds saturate the
    // formation regardless of the difficulty setting.
    count = 0x02;
  } else {
    // Early rounds (below 4) gate the quota on the difficulty byte DIFFICULTY_DSW (0x8820) — the
    // boot-derived DSW1 difficulty tier, which this routine reads as the number of waves that should
    // be active.
    const difficulty = mem8[DIFFICULTY_DSW]; // treats the difficulty byte as the active-wave count
    if (difficulty === 0) return; // no active wave: nothing to spawn this beat, so bow out
    // A low difficulty (1..3) seeds one slot per beat; from 4 up it seeds two.
    count = difficulty < 0x04 ? 0x01 : 0x02;
  }

  // STEP 5 — hand off to the slot-seeding loop.
  // seedFirstFreeSlotForTimedSpawnWithTamperCheck walks FORMATION_SPAWN_TABLE (0x8c60) in
  // BLOCK_STRIDE (0x18) steps and seeds up to `count` of the first free formation slots. Its result
  // is the spawner's result.
  return seedFirstFreeSlotForTimedSpawnWithTamperCheck(m, FORMATION_SPAWN_TABLE, BLOCK_STRIDE, count); // tail: scan/seed the blocks
}
