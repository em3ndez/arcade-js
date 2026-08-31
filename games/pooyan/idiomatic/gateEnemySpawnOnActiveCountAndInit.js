// SPDX-License-Identifier: GPL-3.0-only
import {
  SPEED_INDEX,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPAWN_ACTIVE_FLAG,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
import { seedFirstFreeSpriteBlockInRun } from "./seedFirstFreeSpriteBlockInRun.js";

// The wave budget in numbers. At most six enemy records may be live in the
// ENEMY_ACTOR_TABLE pool at any instant, and the seeding walk scans exactly that
// many record slots looking for a free one to fill. Both constants are the same 6,
// but they answer different questions -- the cap bounds how many actors the game
// will ever run at once; the record count bounds how far the seeding walk marches --
// so they carry separate names.
const ACTIVE_CAP = 0x06; // most records that may be active at once
const INIT_RECORD_COUNT = 0x06; // records the init loop seeds on a launch

/**
 * gateEnemySpawnOnActiveCountAndInit -- enemy-spawn gate (ROM 0x5871-0x588d).
 * Grounding: [seen].
 *
 * WHAT IT IS
 *   One decision of the enemy-spawn throttle. A Pooyan stage lets a bounded
 *   trickle of enemies onto the playfield instead of dumping a whole wave at once;
 *   this routine is the checkpoint that either lets one more actor launch on this
 *   pass or leaves the roster alone.
 *
 * ROLE IN THE MACHINE
 *   It sits between the per-frame spawn cadence and the actual record seeding.
 *   First it refreshes the stage's enemy speed/difficulty index, then it weighs the
 *   live enemy population against two ceilings -- the per-stage wave budget and the
 *   hard roster cap. Only when there is headroom does it flag a spawn in progress
 *   and hand the enemy record pool to the seeder, which claims the first free slot
 *   and initialises one fresh actor.
 *
 * MEMORY IT TOUCHES
 *   SPEED_INDEX          (0x8900) -- enemy speed/difficulty index; written every pass.
 *   ACTIVE_ENEMY_COUNT   (0x8d40) -- count of live enemy records; read as the gate.
 *   STAGE_COUNTDOWN      (0x8901) -- per-stage wave budget/threshold; read as the gate.
 *   SPAWN_ACTIVE_FLAG    (0x8d4a) -- raised to 1 only when a launch is committed.
 *   ENEMY_ACTOR_TABLE    (0x8ae0) -- base of the six enemy records the seeder walks.
 *
 * LIVE-OUT: none. The routine hands nothing back to its caller -- its whole effect
 *   is the latched speed index and, on a launch, the raised spawn flag plus the one
 *   record the seeder initialises. The speed value it stores arrives in the
 *   accumulator (register A) from the caller and is simply parked into memory here.
 */
export function gateEnemySpawnOnActiveCountAndInit(m, speedSeed = m.regs.a) {
  const { mem8 } = m;

  // STEP 1 -- latch the stage's enemy speed. The incoming accumulator value (the
  // difficulty/speed magnitude the caller picked for this wave) is parked into
  // SPEED_INDEX (0x8900). This write is unconditional, ahead of any gate, so the
  // speed index tracks the caller's choice whether or not an actor ends up
  // launching. Downstream movers read this index (clamped below 8) to select a
  // velocity table, so the whole wave inherits the difficulty set here.
  mem8[SPEED_INDEX] = speedSeed;

  // STEP 2 -- read the live enemy population. ACTIVE_ENEMY_COUNT (0x8d40) is the
  // running tally of enemy records currently live in the pool: bumped on each
  // spawn, dropped on each despawn. It is the single quantity both gates weigh.
  const active = mem8[ACTIVE_ENEMY_COUNT];

  // STEP 3 -- the wave-budget gate. STAGE_COUNTDOWN (0x8901) is the per-stage
  // threshold that meters how many enemies the stage releases. If the live count
  // has reached or passed it, the stage has spent its budget for the moment and no
  // fresh actor launches -- back out, leaving the roster untouched. (The machine
  // reaches the same verdict by subtracting count from threshold: a zero difference
  // means "exactly at the threshold" and a borrow means "the count has run past
  // it"; both outcomes mean there is no room.)
  if (mem8[STAGE_COUNTDOWN] <= active) return; // at or below threshold

  // STEP 4 -- the hard roster cap. Independent of the stage budget, at most
  // ACTIVE_CAP (6) enemy records may ever be live at once, because the pool holds
  // exactly six slots. If the count has already filled the roster, back out even
  // when the stage budget would otherwise allow more.
  if (active >= ACTIVE_CAP) return; // roster already full

  // STEP 5 -- commit the launch. Both gates cleared, so raise SPAWN_ACTIVE_FLAG
  // (0x8d4a) to mark that a spawn is in progress on this pass.
  mem8[SPAWN_ACTIVE_FLAG] = 0x01;

  // STEP 6 -- seed one actor. Walk the six enemy records from ENEMY_ACTOR_TABLE
  // (0x8ae0), one slot per step, and initialise the first free one into a brand-new
  // enemy. The seeder claims exactly one slot and then abandons the rest of the
  // walk, so precisely one new actor appears per eligible pass.
  seedFirstFreeSpriteBlockInRun(m, ENEMY_ACTOR_TABLE, INIT_RECORD_COUNT);
}
