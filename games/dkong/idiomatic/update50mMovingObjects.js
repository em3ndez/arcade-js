// SPDX-License-Identifier: GPL-3.0-only
/**
 * update50mMovingObjects — the 50m moving-object subsystem tick. On any board but 50m it does
 * nothing. On 50m it services the spawn request, advances and edge-culls the six-record object
 * row, then refreshes each ACTIVE object's four-byte hardware sprite record (X, code, attr, Y)
 * from the object array. Inactive records are skipped, the sprite cursor still stepping past
 * them, so record i always pairs the i'th object with the i'th sprite slot.
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

const BOARD_MASK_50M = 0x02; // bit1 = 50m
const RECORD_COUNT = 6;
const OBJ_STRIDE = 0x10;
const SPRITE_STRIDE = 0x04;

export function update50mMovingObjects(m) {
  const { regs, mem8 } = m;

  if (!boardBitGate(m, BOARD_MASK_50M)) return;

  service50mObjectSpawnRequest(m);

  advance50mObjectRow(m);

  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = OBJ_ARRAY_65A0 + OBJ_STRIDE * i;
    const sprite = OBJ_65A0_SPRITES + SPRITE_STRIDE * i;

    // Inactive: leave the sprite slot as the advance stage left it, cursor still advancing.
    if (mem8[obj + OBJ_ACTIVE] === 0) continue;

    mem8[sprite + SPRITE_X] = mem8[obj + OBJ_X];
    mem8[sprite + SPRITE_CODE] = mem8[obj + OBJ_SPRITE_CODE];
    mem8[sprite + SPRITE_ATTR] = mem8[obj + OBJ_SPRITE_ATTR];
    mem8[sprite + SPRITE_Y] = mem8[obj + OBJ_Y];
  }
}
