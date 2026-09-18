// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateEnemy1 — the per-frame enemy pass: drive enemy 1 through the shared move/collision driver,
 * stage its sprite record, then hand off enemy 2.
 *
 * The object-record analog of the actor movers: two mover records are stepped through one shared
 * driver working out of a single fixed block — copy the record in, step and collide it in place, copy
 * it back. Until the intro/phase counter passes its opening neither mover runs; otherwise object 1
 * always steps and stages its sprite record (three bytes verbatim plus a fourth shifted by the
 * cabinet sprite-coordinate bias), then object 2 runs the identical pass unless the attract demo is
 * still in its opening window. Both delegates are tail calls, returning to this routine's caller.
 */

import { stepEnemyMover } from "./stepEnemyMover.js";
import { advanceTwoSpriteActor } from "./advanceTwoSpriteActor.js";
import { updateEnemy2 } from "./updateEnemy2.js";
import { PLAY_PHASE_COUNTER, ENEMY1_X, SPRITE_COORD_BIAS, GAME_STATE, SPRITE_STAGING_BASE, ENEMY_WORK_X } from "./names.js";

// Object 1's 4-byte record in the sprite-staging buffer.
const OBJ1_SPRITE_RECORD = SPRITE_STAGING_BASE + 16;
// The move records (and their working-block copies) are 17 bytes each.
const RECORD_SIZE = 17;

/** Advance one 17-byte object record through the move/collision driver: copy it into the
 *  driver's working block, run the driver, then copy the stepped result back. */
function driveRecordThroughMover(m, recordBase) {
  const { mem8 } = m;
  for (let i = 0; i < RECORD_SIZE; i++) mem8[ENEMY_WORK_X + i] = mem8[recordBase + i];
  stepEnemyMover(m);
  for (let i = 0; i < RECORD_SIZE; i++) mem8[recordBase + i] = mem8[ENEMY_WORK_X + i];
}

export function updateEnemy1(m) {
  const { mem8 } = m;

  // Until the intro/phase counter has passed its opening, neither object mover steps.
  if (mem8[PLAY_PHASE_COUNTER] < 8) return advanceTwoSpriteActor(m);

  // Object 1 steps, then stages its record: three bytes verbatim, the 4th shifted by the bias.
  driveRecordThroughMover(m, ENEMY1_X);
  for (let i = 0; i < 3; i++) mem8[OBJ1_SPRITE_RECORD + i] = mem8[ENEMY1_X + i];
  mem8[OBJ1_SPRITE_RECORD + 3] = mem8[ENEMY1_X + 3] + mem8[SPRITE_COORD_BIAS];

  // Object 2 runs the identical pass next, unless the attract demo is still in its opening window.
  if (mem8[GAME_STATE] === 4 && mem8[PLAY_PHASE_COUNTER] < 10) return advanceTwoSpriteActor(m);
  return updateEnemy2(m);
}
