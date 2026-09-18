// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateEnemy2 — advance enemy 2 one frame and stage its sprite.
 *
 * The enemy-2 half of the two-enemy pass: updateEnemy1 runs enemy 1, then hands here for enemy
 * 2. Both share one mover, stepEnemyMover, which works out of a scratch block rather than either
 * record directly. This copies object 2's 17-byte record into that scratch, runs the mover step
 * on the copy (read position, probe surrounding maze cells, resolve arrival/capture, commit a
 * move), copies the result back, stages object 2's sprite, then continues into the shared
 * per-frame actor update. Structurally identical to updateEnemy1's object-1 body.
 */

import { ENEMY2_X, ENEMY_WORK_X, SPRITE_COORD_BIAS, SPRITE_STAGING_BASE } from "./names.js";
import { stepEnemyMover } from "./stepEnemyMover.js";
import { advanceTwoSpriteActor } from "./advanceTwoSpriteActor.js";

// The shared 17-byte scratch block the mover (stepEnemyMover) reads and updates in place.
const OBJECT_RECORD_BYTES = 17;

// Object 2's four-byte slot in the sprite staging buffer (the sixth of eight slots).
const OBJ2_SPRITE_RECORD = SPRITE_STAGING_BASE + 20;

export function updateEnemy2(m) {
  const { mem8 } = m;

  // Copy the record into the mover scratch, step the mover, copy the result back.
  for (let i = 0; i < OBJECT_RECORD_BYTES; i++) mem8[ENEMY_WORK_X + i] = mem8[ENEMY2_X + i];
  stepEnemyMover(m);
  for (let i = 0; i < OBJECT_RECORD_BYTES; i++) mem8[ENEMY2_X + i] = mem8[ENEMY_WORK_X + i];

  // Stage the sprite: position/tile/attribute verbatim, fourth byte shifted by the coord offset.
  for (let i = 0; i < 3; i++) mem8[OBJ2_SPRITE_RECORD + i] = mem8[ENEMY2_X + i];
  mem8[OBJ2_SPRITE_RECORD + 3] = mem8[ENEMY2_X + 3] + mem8[SPRITE_COORD_BIAS];

  // Continue into the shared per-frame actor update; its return carries back to our caller.
  return advanceTwoSpriteActor(m);
}
