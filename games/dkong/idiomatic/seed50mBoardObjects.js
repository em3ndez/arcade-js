// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed50mBoardObjects — build the 50m board's object and hardware-sprite records.
 *
 * The board-2 arm of the board-object setup dispatch: a one-shot, input-free initialiser
 * that seeds a fixed set of object records and permutes them into the sprite mirrors via
 * five setup helpers and four fixed-table block copies, then sets the board-object
 * bookkeeping marker.
 *
 * LIVE-OUT: memory-only — the object and hardware-sprite records this arm writes, plus
 * the board-object bookkeeping marker.
 */

import { page, u16 } from "../../../core/int.js";
import {
  OBJ_ARRAY_64,
  OBJ_ARRAY_65A0,
  OBJ_65A0_SPRITES,
  OBJECT_COLLISION_SPRITES,
  loc_69fc,
  loc_6944,
  M50_OBJ1_SPRITE_PAIR_BASE,
  FIXED_HAZARD_PHASE,
  OBJ_ARRAY_64_TEMPLATE,
  OBJ_ARRAY_65A0_TEMPLATE,
  OBJ_RECORD_66A0_TEMPLATE_50M,
  SPRITE_69FC_TEMPLATE_50M,
  SPRITE_6944_TEMPLATE_50M,
  M50_OBJ1_SPRITE_PAIR_TEMPLATE,
  OBJ_PAIR_6680_POSITION_TABLE_50M,
  COLLISION_SPRITES_TEMPLATE_50M,
} from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

function copyBlock(mem8, src, dst, n) {
  for (let i = 0; i < n; i++) {
    mem8[u16(dst + i)] = mem8[u16(src + i)];
  }
}

export function seed50mBoardObjects(m) {
  const { mem8 } = m;

  // dest OBJ_ARRAY_64+7; 5 records, stride 0x1c
  replicateGroupStrided(m, OBJ_ARRAY_64_TEMPLATE, 0x1c, OBJ_ARRAY_64, 0x05, 0x07);

  seedObjectBlockSprites(m);

  // dest OBJ_ARRAY_65A0+7 — the +7 splits across a page boundary; 6 records, stride 0x0c
  replicateGroupStrided(m, OBJ_ARRAY_65A0_TEMPLATE, 0x0c, page(OBJ_ARRAY_65A0), 0x06, (OBJ_ARRAY_65A0 + 0x07) & 0xff);

  gatherSpriteRecords(m, 16, 0x06, page(OBJ_65A0_SPRITES), OBJ_65A0_SPRITES & 0xff, OBJ_ARRAY_65A0);

  loc_11fa(m, OBJ_RECORD_66A0_TEMPLATE_50M);

  copyBlock(mem8, SPRITE_69FC_TEMPLATE_50M, loc_69fc, 4);
  copyBlock(mem8, SPRITE_6944_TEMPLATE_50M, loc_6944, 8);
  copyBlock(mem8, M50_OBJ1_SPRITE_PAIR_TEMPLATE, M50_OBJ1_SPRITE_PAIR_BASE, 24);

  seedSpriteObjectPair(m, OBJ_PAIR_6680_POSITION_TABLE_50M);

  copyBlock(mem8, COLLISION_SPRITES_TEMPLATE_50M, OBJECT_COLLISION_SPRITES, 12); // 3 collision records (stride 4)
  mem8[FIXED_HAZARD_PHASE] = 0x01; // board-object bookkeeping: this board is set up
}
