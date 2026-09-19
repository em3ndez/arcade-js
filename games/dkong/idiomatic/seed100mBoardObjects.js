// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed100mBoardObjects — the board-4 arm of the per-board setup dispatch. Takes no inputs:
 * every pointer, count and stride is a fixed constant, so it always lays down the same 100m
 * object and sprite state from template data. Seeds five object records, a sprite-object pair
 * and three collision-sprite records, then activates two FIRE records and gathers each into a
 * four-byte hardware sprite record with its fields permuted (+3, +7, +8, +5).
 *
 * LIVE-OUT: memory-only — the seeded object records, collision-sprite bytes and two hardware
 * sprite records. It returns into a caller that reloads every register.
 */

import {
  FIRE_RECORDS_100M,
  FIRE_RECORDS_100M_CODE,
  FIRE_RECORDS_100M_X,
  M100_FIRE_SPRITE_PAIR,
  OBJ_ARRAY_64,
  OBJ_SPRITE_CODE,
  OBJECT_COLLISION_SPRITES,
  OBJ_ARRAY_64_TEMPLATE_100M,
  OBJ_PAIR_6680_POSITION_TABLE_100M,
  COLLISION_SPRITES_TEMPLATE_100M,
  OBJ_ARRAY_64_POSITION_TABLE_100M_EXTRA,
  OBJ_ARRAY_64_TEMPLATE_100M_EXTRA,
} from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";

const LDIR_BYTES = 0x0c; // step 3: twelve bytes into the collision-sprite records

export function seed100mBoardObjects(m) {
  const { regs, mem8 } = m;

  regs.hl = OBJ_ARRAY_64_TEMPLATE_100M; // source group, re-read every pass
  regs.de = (OBJ_ARRAY_64 + OBJ_SPRITE_CODE); // destination record base
  regs.bc = 0x051c; // five records; the stride argument is four short of the record stride
  replicateGroupStrided(m);

  regs.hl = OBJ_PAIR_6680_POSITION_TABLE_100M;
  seedSpriteObjectPair(m);

  let src = COLLISION_SPRITES_TEMPLATE_100M;
  let dst = OBJECT_COLLISION_SPRITES;
  for (let i = 0; i < LDIR_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  regs.hl = OBJ_ARRAY_64_POSITION_TABLE_100M_EXTRA; // the position table, laid down just after the routine body
  regs.de = FIRE_RECORDS_100M_X; // destination: the first record's +3
  regs.bc = 0x021e; // two records
  copyBytePairsStrided(m);

  regs.hl = OBJ_ARRAY_64_TEMPLATE_100M_EXTRA; // the appearance group
  regs.de = FIRE_RECORDS_100M_CODE; // destination: the first record's +7
  regs.bc = 0x021c; // two records
  replicateGroupStrided(m);

  regs.ix = FIRE_RECORDS_100M;
  mem8[(regs.ix + 0x00) & 0xffff] = 0x01;
  mem8[(regs.ix + 0x20) & 0xffff] = 0x01; // the second record, one stride on
  regs.hl = M100_FIRE_SPRITE_PAIR; // sprite-record destination
  regs.b = 0x02; // two records
  regs.de = 0x0020; // per-record source stride
  gatherSpriteRecords(m);
}
