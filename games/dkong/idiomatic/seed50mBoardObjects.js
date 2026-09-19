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

import { OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_65A0_SPRITES, OBJECT_COLLISION_SPRITES, loc_69fc, loc_6944, M50_OBJ1_SPRITE_PAIR_BASE, FIXED_HAZARD_PHASE } from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

function copyBlock(mem8, src, dst, n) {
  for (let i = 0; i < n; i++) {
    mem8[(dst + i) & 0xffff] = mem8[(src + i) & 0xffff];
  }
}

export function seed50mBoardObjects(m) {
  const { regs, mem8 } = m;

  // dest OBJ_ARRAY_64+7; 5 records, stride 0x1c
  replicateGroupStrided(m, 0x3dec, 0x1c, OBJ_ARRAY_64, 0x05, 0x07);

  seedObjectBlockSprites(m);

  // dest OBJ_ARRAY_65A0+7 — the +7 splits across a page boundary; 6 records, stride 0x0c
  replicateGroupStrided(m, 0x3e18, 0x0c, OBJ_ARRAY_65A0 & 0xff00, 0x06, (OBJ_ARRAY_65A0 + 0x07) & 0xff);

  gatherSpriteRecords(m, 0x0010, 0x06, OBJ_65A0_SPRITES & 0xff00, OBJ_65A0_SPRITES & 0xff, OBJ_ARRAY_65A0);

  loc_11fa(m, 0x3dfa);

  copyBlock(mem8, 0x3e04, loc_69fc, 0x0004);
  copyBlock(mem8, 0x3e1c, loc_6944, 0x0008);
  copyBlock(mem8, 0x3e24, M50_OBJ1_SPRITE_PAIR_BASE, 0x0018);

  regs.hl = 0x3e10; // seedSpriteObjectPair reads its position-table pointer from hl
  seedSpriteObjectPair(m);

  copyBlock(mem8, 0x3e3c, OBJECT_COLLISION_SPRITES, 0x000c); // 3 collision records (stride 4)
  mem8[FIXED_HAZARD_PHASE] = 0x01; // board-object bookkeeping: this board is set up
}
