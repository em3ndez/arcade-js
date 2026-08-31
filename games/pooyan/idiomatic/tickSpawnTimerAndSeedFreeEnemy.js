// SPDX-License-Identifier: GPL-3.0-only
import { seedFreeEnemyRecordFromRoundTables } from "./seedFreeEnemyRecordFromRoundTables.js";
import {
  ENEMY_SPAWN_TIMER,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

/**
 * tickSpawnTimerAndSeedFreeEnemy -- the enemy spawn-cadence tick (ROM 0x1171, grounding: [seen]).
 *
 * WHAT IT IS
 *   One tick of the machine that decides, each play frame, whether the current stage is allowed to
 *   introduce a new enemy into the world -- and if so, which record in the enemy pool that enemy
 *   takes. It runs as one link in the per-frame worker chain during active play.
 *
 * ROLE IN THE MACHINE
 *   Enemies are not all spawned at once; a stage feeds them in a few at a time. Two things throttle
 *   that feed: a cadence countdown (how often a spawn may happen) and a pair of population gates
 *   (whether a spawn is still owed and whether there is room). This routine is the throttle. When
 *   all three conditions line up it seeds exactly one free record in the enemy pool; otherwise it
 *   does nothing but age the countdown.
 *
 *   The enemy pool is ENEMY_ACTOR_TABLE (0x8ae0): six fixed-size records of stride 0x18, each with
 *   a header byte that is nonzero while the record holds a live enemy and zero while it is free.
 *   Filling a free record is what "spawning an enemy" means here.
 *
 * LIVE-OUT (memory)
 *   - Cadence branch: ENEMY_SPAWN_TIMER (0x8d07) decremented by one; nothing else changes.
 *   - Spawn branch: one previously-free record in ENEMY_ACTOR_TABLE (0x8ae0) is left active, and
 *     the per-record initialiser it calls also reseeds ENEMY_SPAWN_TIMER (0x8d07) and bumps
 *     ACTIVE_ENEMY_COUNT (0x8d40) as it activates the record.
 *   Nothing is handed back to the caller; the frame chain reads no result from this tick.
 */

const SPAWN_SEED = 0x1d; // activation seed handed to the initialiser; stamped into the new record's +4 field
const MAX_ACTIVE = 0x06; // hard ceiling on simultaneously-live enemies (equals the pool size)
const RECORD_STRIDE = 0x18; // byte stride between adjacent records in ENEMY_ACTOR_TABLE
const RECORD_COUNT = 6; // number of enemy records swept at ENEMY_ACTOR_TABLE (0x8ae0)

export function tickSpawnTimerAndSeedFreeEnemy(m) {
  const { mem8 } = m;

  // --- Cadence countdown (ENEMY_SPAWN_TIMER, 0x8d07) ---
  // This timer paces how often the stage is allowed to introduce a new enemy. It is reloaded at
  // various stage/round entries (values such as 0x20 / 0x40 / 0x80) and drains one tick per frame.
  // While it is still counting, this frame is not a spawn opportunity: age it by one and leave.
  if (mem8[ENEMY_SPAWN_TIMER] !== 0) {
    mem8[ENEMY_SPAWN_TIMER] = mem8[ENEMY_SPAWN_TIMER] - 1;
    return;
  }

  // --- Population gates (reached only once the cadence timer has expired) ---
  // The timer being at zero only makes this a *candidate* spawn frame; two population checks decide
  // whether an enemy actually enters. Both must pass before any record is touched.
  const active = mem8[ACTIVE_ENEMY_COUNT];
  // Gate 1: the per-stage budget STAGE_COUNTDOWN (0x8901) must still be ahead of the number of
  // enemies already live (ACTIVE_ENEMY_COUNT, 0x8d40). The stage countdown drains from 0x20 across
  // a stage; while it exceeds the live count the stage still owes more enemies, so a spawn is due.
  // Once the live count catches up to it (equal or greater), the stage is fully fed -- do nothing.
  if (mem8[STAGE_COUNTDOWN] <= active) return; // stage countdown not ahead of the active count
  // Gate 2: never overflow the six-record pool. If six enemies are already live there is no free
  // record to seed, so skip the sweep entirely.
  if (active >= MAX_ACTIVE) return; // pool already full

  // --- Seed the first free record (ENEMY_ACTOR_TABLE, 0x8ae0; stride 0x18) ---
  // Walk the six enemy records in order and hand each to the per-record initialiser (ROM 0x119a)
  // with the activation seed 0x1d. That initialiser leaves an already-active record untouched and
  // reports "keep scanning" (truthy); when it reaches a free record it activates it -- stamping the
  // seed into the record's +4 field, reseeding ENEMY_SPAWN_TIMER (0x8d07), and bumping
  // ACTIVE_ENEMY_COUNT (0x8d40) -- then reports "seeded" (falsy), which ends the sweep. So exactly
  // one enemy is spawned per qualifying frame; if every record was already active the loop just
  // runs out having done nothing.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    if (!seedFreeEnemyRecordFromRoundTables(m, rec, SPAWN_SEED)) return; // seeded a free record -> sweep done
    rec = rec + RECORD_STRIDE;
  }
}
