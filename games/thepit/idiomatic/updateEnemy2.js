// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateEnemy2 — advance enemy 2 (record 0x80f9) one frame and stage its sprite.  ROM 0x316f. (§2.4)
 *
 * The enemy-2 half of the two-enemy pass: updateEnemy1 runs enemy 1, then hands
 * here for enemy 2 (both share one mover, stepEnemyMover, which works out of a scratch
 * block rather than either record directly). For object 2 this:
 *
 *   - copies object 2's 17-byte record into the shared mover scratch block,
 *   - runs the mover step on that scratch copy — it reads the position, probes the
 *     surrounding maze cells, resolves arrival / capture, and commits a move,
 *   - copies the (now possibly moved) scratch block back over object 2's record,
 *   - stages object 2's sprite into its slot of the sprite staging buffer: the first
 *     three record bytes (position, tile, attribute) verbatim, then a fourth byte =
 *     the record's fourth byte shifted by the sprite coordinate offset,
 *   - and continues into the shared per-frame actor update, whose own return carries
 *     back to this pass's caller.
 *
 * Structurally identical to updateEnemy1's object-1 body, only with object 2's record
 * (ENEMY2_X) and sprite slot in place of object 1's.
 *
 * Memory-equivalent to the frozen oracle — equivalence-316f.test.js.
 * GATE:     real captured attract dispatches (object 2 runs ~2000× in the demo) with
 *           the shared actor-update tail (0x3748) stubbed identically on both sides so
 *           the mover's own work is isolated; compared over work RAM (dumpState)
 *           outside the dead stack scratch the oracle's mover call leaves. Teeth catch
 *           a corrupted staged sprite byte and a dropped coordinate bias.
 * LIVE-OUT: memory-only — object 2's record, the mover's writes, and the four staged
 *           sprite bytes. The routine is reached by tail-jump and continues by
 *           tail-jump, so no caller reads a value register back (dead ABI).
 * NAMES:    ENEMY2_X (0x80f9, the object-2 record base), SPRITE_COORD_BIAS (0x8051),
 *           SPRITE_STAGING_BASE (0x8220) from ram.js; the shared mover scratch block
 *           base is ENEMY_WORK_X (0x8083).
 */

import { ENEMY2_X, ENEMY_WORK_X, SPRITE_COORD_BIAS, SPRITE_STAGING_BASE } from "./ram.js";
import { stepEnemyMover } from "./stepEnemyMover.js";
import { advanceTwoSpriteActor } from "./advanceTwoSpriteActor.js";

// The shared 17-byte scratch block the mover (stepEnemyMover) reads and updates in place.
const OBJECT_RECORD_BYTES = 17;

// Object 2's four-byte slot in the sprite staging buffer (the sixth of eight slots).
const OBJ2_SPRITE_RECORD = SPRITE_STAGING_BASE + 20;

export function updateEnemy2(m) {
  const { mem8 } = m;

  // Stage object 2's record into the mover scratch, step the mover on it, then copy the
  // updated scratch back over the record.
  for (let i = 0; i < OBJECT_RECORD_BYTES; i++) mem8[ENEMY_WORK_X + i] = mem8[ENEMY2_X + i];
  stepEnemyMover(m);
  for (let i = 0; i < OBJECT_RECORD_BYTES; i++) mem8[ENEMY2_X + i] = mem8[ENEMY_WORK_X + i];

  // Stage object 2's sprite: position/tile/attribute verbatim, then the fourth byte
  // shifted by the sprite coordinate offset.
  for (let i = 0; i < 3; i++) mem8[OBJ2_SPRITE_RECORD + i] = mem8[ENEMY2_X + i];
  mem8[OBJ2_SPRITE_RECORD + 3] = mem8[ENEMY2_X + 3] + mem8[SPRITE_COORD_BIAS];

  // Continue into the shared per-frame actor update (advanceTwoSpriteActor, ROM 0x3748), called
  // directly now that it is decompiled — same as updateEnemy1 does.
  return advanceTwoSpriteActor(m);
}
