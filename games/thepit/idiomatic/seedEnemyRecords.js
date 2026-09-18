// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedEnemyRecords — seed the enemy records (the second block of round/level setup), derive the
 * difficulty-scaled enemy-speed pair, then hand off to the actor-spawn seeder (enemy #3).
 *
 * The second half of the round/level parameter-seeding pass — seedChamberCreature fills the first
 * block, then jumps straight here. This routine fills its own block of subsystem parameter/counter
 * bytes with fixed start values, derives one pair of bytes from the round's LEVEL / difficulty
 * counter, and writes that pair into two mirrored slots. The pair scales with difficulty: keeping
 * only two selector bits of the counter and subtracting from seven, it steps down 7, 5, 3, 1 as
 * difficulty climbs (a smaller value at a harder level — grounded: the level-1→2 rebuild went
 * 7→5). It then tail-hands to seedActorSpawnState, whose own return unwinds back to this routine's
 * caller, so the delegation IS the exit. Every write lands on a distinct byte, so their order does
 * not matter, and the two mirrored slots always receive the same derived value.
 */

import { seedActorSpawnState } from "./seedActorSpawnState.js";

import {
  LEVEL,
  ENEMY1_ATTR,
  ENEMY1_MOVE_PERIOD,
  ENEMY1_SPRITE,
  ENEMY1_STATE,
  ENEMY1_TARGET_COL,
  ENEMY1_TIMER,
  ENEMY1_X,
  ENEMY1_Y,
  ENEMY2_ATTR,
  ENEMY2_MOVE_PERIOD,
  ENEMY2_STATE,
  ENEMY2_TARGET_COL,
  ENEMY2_SPRITE,
  ENEMY2_TIMER,
  ENEMY2_X,
} from "./names.js";
export function seedEnemyRecords(m) {
  const { mem8 } = m;

  // Fixed start values for the parameter/counter block.
  mem8[ENEMY1_SPRITE] = 9;
  mem8[ENEMY1_X] = 236;
  mem8[ENEMY1_Y] = 35;
  mem8[ENEMY1_ATTR] = 4;
  mem8[ENEMY1_STATE] = 1;
  mem8[ENEMY1_TIMER] = 1;
  mem8[ENEMY1_TARGET_COL] = 4;

  // Difficulty-scaled pair: read the level/difficulty counter, keep only its two low-order
  // selector bits (leaving 0, 2, 4, or 6), and subtract from seven so the pair steps down
  // 7, 5, 3, 1 as difficulty climbs. Both mirrored slots get it.
  const difficultyStep = 7 - (mem8[LEVEL] & 0x06);
  mem8[ENEMY1_MOVE_PERIOD] = difficultyStep;
  mem8[ENEMY2_MOVE_PERIOD] = difficultyStep;

  // More fixed start values.
  mem8[ENEMY2_SPRITE] = 9;
  mem8[ENEMY2_ATTR] = 4;
  mem8[ENEMY2_X] = 0;
  mem8[ENEMY2_STATE] = 0;
  mem8[ENEMY2_TIMER] = 1;
  mem8[ENEMY2_TARGET_COL] = 5;

  // Tail hand-off into seedActorSpawnState; its return goes to our caller, so this is the exit.
  return seedActorSpawnState(m);
}
