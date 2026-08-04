// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBoardObjects — service the six board objects for one pass, then publish their
 * positions to the sprite buffer.
 *
 * OBJ_ARRAY_66 holds six 16-byte board-object records. Once per board-object service pass
 * this does three things in order:
 *
 *   1. ADVANCE — step every active object one pixel toward its limit, landing or
 *      deactivating it on arrival.
 *   2. SPAWN — on the spawn cadence, claim a free slot and seed a new object;
 *      otherwise just tick the cadence timer.
 *   3. PUBLISH — walk all six records and copy each object's X and Y into its own
 *      4-byte sprite record in the sprite shadow buffer, so the object renders at
 *      its current position. X lands at the record's first byte, Y at its fourth;
 *      the six records sit consecutively from SPRITE_BUFFER + 88 (sprite record 22).
 *
 * The order matters: advance and spawn are what MOVE the objects, and the publish
 * walk reads the positions they just produced — so the sprite records always show
 * this pass's motion.
 *
 * WHAT THE NAME DOES NOT CLAIM: the name describes the STRUCTURAL service pass — advance,
 * spawn, mirror positions to sprites — and says nothing about what these objects ARE in
 * gameplay. That identity is not established here, so the record fields keep their generic
 * object vocabulary.
 *
 * LIVE-OUT: memory-only — the six object records and the six published sprite records inside
 * SPRITE_BUFFER.
 */

import { OBJ_ARRAY_66, OBJ_X, OBJ_Y, SPRITE_BUFFER } from "./names.js";
import { advanceBoardObjectTravel } from "./advanceBoardObjectTravel.js";
import { spawnBoardObject } from "./spawnBoardObject.js";

const RECORD_COUNT = 6;      // six board objects
const OBJ_STRIDE = 16;       // stride between object records in OBJ_ARRAY_66
const SPRITE_STRIDE = 4;     // stride between sprite records in SPRITE_BUFFER
const PUBLISH_BASE = SPRITE_BUFFER + 88; // the objects' sprite records: record 22 onward
const SPRITE_Y = 3;          // Y byte offset within a 4-byte sprite record (X is byte 0)

/**
 * @param {object} m  the machine (uses m.mem; direct-calls the two service callees).
 * @returns {void}
 */
export function serviceBoardObjects(m) {
  const { mem } = m;

  // Advance the existing objects, then try to spawn a new one.
  advanceBoardObjectTravel(m);
  spawnBoardObject(m);

  // Publish: mirror each object's current X and Y into its sprite record.
  let src = OBJ_ARRAY_66;
  let dst = PUBLISH_BASE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    mem.write8(dst, mem.read8(src + OBJ_X));
    mem.write8(dst + SPRITE_Y, mem.read8(src + OBJ_Y));
    dst += SPRITE_STRIDE;
    src += OBJ_STRIDE;
  }
}
