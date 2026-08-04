// SPDX-License-Identifier: GPL-3.0-only
/**
 * update50mMovingObjects — the 50m moving-object subsystem tick.
 *
 * Runs every pass of the per-frame update cascade. Its first act is a per-board skip test on the
 * 50m bit, so on any other board the whole routine does nothing at all. On 50m it runs three
 * stages in order:
 *
 *   1. service the moving-object spawn request;
 *   2. advance and edge-cull the six-record object row;
 *   3. refresh each object's hardware sprite record from the object array, so the display picks
 *      up this frame's object positions.
 *
 * The refresh walks the six object records alongside their six matching four-byte sprite records.
 * For an ACTIVE record — activity byte non-zero, tested as a whole byte, not a single bit — it
 * copies four fields across in sprite-record order: X, sprite code, attribute, Y.
 *
 * An INACTIVE record is left untouched: only the sprite write cursor steps past its four bytes, so
 * that slot keeps whatever the advance stage last left there, which is a blanked record when the
 * object was just culled. Both cursors advance a fixed stride per record on every path, so record
 * i always pairs the i'th object with the i'th sprite slot.
 *
 * LIVE-OUT: memory-only.
 */

import { boardBitGate } from "./boardBitGate.js";
import { service50mObjectSpawnRequest } from "./service50mObjectSpawnRequest.js";
import { advance50mObjectRow } from "./advance50mObjectRow.js";
import {
  OBJ_ARRAY_65A0,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
  SPRITE_X,
  SPRITE_CODE,
  SPRITE_ATTR,
  SPRITE_Y,
  OBJ_65A0_SPRITES,} from "./names.js";

const BOARD_MASK_50M = 0x02; // per-board applicability mask: bit1 = 50m (this subsystem's board)
const RECORD_COUNT = 6;      // objects this subsystem tracks
const OBJ_STRIDE = 0x10;     // object-record stride
const SPRITE_STRIDE = 0x04;  // four-byte hardware sprite record

export function update50mMovingObjects(m) {
  const { regs, mem } = m;

  // Stage 0 — per-board skip: only 50m runs this subsystem.
  regs.a = BOARD_MASK_50M;
  if (!boardBitGate(m)) return;

  // Stage 1 — service the moving-object spawn request.
  service50mObjectSpawnRequest(m);

  // Stage 2 — advance and edge-cull the object row.
  advance50mObjectRow(m);

  // Stage 3 — refresh each active object's sprite record from the object array.
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = OBJ_ARRAY_65A0 + OBJ_STRIDE * i;
    const sprite = OBJ_65A0_SPRITES + SPRITE_STRIDE * i;

    // Inactive record: leave its sprite slot exactly as the advance stage left it.
    if (mem.read8(obj + OBJ_ACTIVE) === 0) continue;

    // Copy the object's four display fields into the sprite record, in record order.
    mem.write8(sprite + SPRITE_X, mem.read8(obj + OBJ_X));
    mem.write8(sprite + SPRITE_CODE, mem.read8(obj + OBJ_SPRITE_CODE));
    mem.write8(sprite + SPRITE_ATTR, mem.read8(obj + OBJ_SPRITE_ATTR));
    mem.write8(sprite + SPRITE_Y, mem.read8(obj + OBJ_Y));
  }
}
