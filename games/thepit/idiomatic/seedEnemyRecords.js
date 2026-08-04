// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedEnemyRecords — seed the enemy records (the second block of round/level setup), derive the
 * difficulty-scaled enemy-speed pair (0x07-(level&6) = 7,5,3,1), then hand off to seedActorSpawnState
 * (enemy #3).  ROM 0x30de. (§2.4)
 *
 * The second half of the round/level parameter-seeding pass — seedChamberCreature fills the
 * first block, then jumps straight here. This routine fills its own block of
 * subsystem parameter/counter bytes with fixed start values, derives a single pair
 * of bytes from the round's level/difficulty counter, and writes that pair into two
 * mirrored slots. The pair scales with difficulty: keeping only two selector bits of
 * the counter and subtracting from seven, it steps down 7, 5, 3, 1 as difficulty
 * climbs — a smaller value at a harder level. It then hands straight on to
 * seedActorSpawnState, which puts the actor pair's records into their start state.
 * That hand-off is a tail jump: seedActorSpawnState's own return unwinds back to
 * seedEnemyRecords's caller, so the delegation IS seedEnemyRecords's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state; the two mirrored slots always receive the same derived value.
 *
 * The block it seeds is the enemy records, and the derived pair is the enemy-speed difficulty
 * scaling (§2.4, grounded: at the level-1→2 rebuild the pair went 7→5 — "the game just gets
 * faster"). The counter it reads is LEVEL (0x8028).
 *
 * Memory-equivalent to the frozen oracle — equivalence-30de.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from the
 *           gameplay round-init tail-jump chain, which attract never reaches), so it
 *           is validated on real captured attract machine states. It reads only the
 *           difficulty counter, so any realistic state is a valid entry: EQUAL over
 *           several captured states + a sentinel-preset entry that makes every write
 *           observable, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded parameter bytes and the derived pair. The
 *           round-init caller consumes the seeded memory, not any register; the tail
 *           owns everything after the hand-off, identically on both sides.
 * NAMES:    ENEMY1_X (0x80e8), ENEMY1_SPRITE (0x80e9), ENEMY1_ATTR (0x80ea),
 *           ENEMY1_MOVE_PERIOD (0x80f6), ENEMY1_TARGET_COL (0x80f8), ENEMY2_X (0x80f9),
 *           ENEMY2_SPRITE (0x80fa) and ENEMY2_ATTR (0x80fb), plus the LEVEL difficulty counter
 *           (0x8028), and ENEMY1_TIMER (0x80f0), ENEMY1_STATE (0x80f5), ENEMY2_TIMER (0x8101),
 *           ENEMY2_STATE (0x8106), ENEMY2_MOVE_PERIOD (0x8107), ENEMY2_TARGET_COL (0x8109), from
 *           names.js; the rest of the parameter block is ENEMY1_Y (0x80eb).
 *           The tail is the decompiled seedActorSpawnState (ROM 0x36fe).
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

  // Difficulty-scaled pair: read the round's level/difficulty counter, keep only its
  // two low-order selector bits (leaving 0, 2, 4, or 6), and subtract from seven so
  // the pair steps down 7, 5, 3, 1 as difficulty climbs. Both mirrored slots get it.
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

  // Tail hand-off into seedActorSpawnState; its return goes to our caller, so this
  // is seedEnemyRecords's exit.
  return seedActorSpawnState(m);
}
