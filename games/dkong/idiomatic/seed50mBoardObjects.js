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

import { OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_65A0_SPRITES, OBJECT_COLLISION_SPRITES } from "./names.js";
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

  regs.hl = 0x3dec;
  regs.de = OBJ_ARRAY_64 + 0x07; // field +7 of the first of 5 stride-0x20 records
  regs.bc = 0x051c; // 5 records; stride byte 0x1c (record stride = this + 4)
  replicateGroupStrided(m);

  seedObjectBlockSprites(m);

  regs.hl = 0x3e18;
  regs.de = OBJ_ARRAY_65A0 + 0x07; // field +7 of the first of 6 stride-0x10 records
  regs.bc = 0x060c; // 6 records; stride byte 0x0c (record stride = this + 4)
  replicateGroupStrided(m);

  regs.ix = OBJ_ARRAY_65A0;
  regs.hl = OBJ_65A0_SPRITES;
  regs.de = 0x0010;
  regs.b = 0x06;
  gatherSpriteRecords(m);

  regs.hl = 0x3dfa;
  loc_11fa(m);

  copyBlock(mem8, 0x3e04, 0x69fc, 0x0004);
  copyBlock(mem8, 0x3e1c, 0x6944, 0x0008);
  copyBlock(mem8, 0x3e24, 0x69e4, 0x0018);

  regs.hl = 0x3e10;
  seedSpriteObjectPair(m);

  copyBlock(mem8, 0x3e3c, OBJECT_COLLISION_SPRITES, 0x000c); // 3 collision records (stride 4)
  mem8[0x62b9] = 0x01; // board-object bookkeeping: this board is set up
}
