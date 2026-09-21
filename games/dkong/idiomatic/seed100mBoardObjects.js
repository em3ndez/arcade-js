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

import { u16 } from "../../../core/int.js";
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

  // Broadcast the source group into five strided records (source re-read every pass; dest base
  // OBJ_ARRAY_64+7, in-page start +7, stride four short of the record stride).
  replicateGroupStrided(
    m,
    OBJ_ARRAY_64_TEMPLATE_100M,
    0x1c,
    (OBJ_ARRAY_64 + OBJ_SPRITE_CODE) & 0xff00,
    0x05,
    (OBJ_ARRAY_64 + OBJ_SPRITE_CODE) & 0xff,
  );

  seedSpriteObjectPair(m, OBJ_PAIR_6680_POSITION_TABLE_100M);

  let src = COLLISION_SPRITES_TEMPLATE_100M;
  let dst = OBJECT_COLLISION_SPRITES;
  for (let i = 0; i < LDIR_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = u16(src + 1);
    dst = u16(dst + 1);
  }

  // Scatter the position table (byte pairs) into +3/+5 of the two extra records (two records).
  copyBytePairsStrided(m, OBJ_ARRAY_64_POSITION_TABLE_100M_EXTRA, FIRE_RECORDS_100M_X, 0x1e, 0x02);

  // Broadcast the appearance group into +7..+a of the same two records.
  replicateGroupStrided(
    m,
    OBJ_ARRAY_64_TEMPLATE_100M_EXTRA,
    0x1c,
    FIRE_RECORDS_100M_CODE & 0xff00,
    0x02,
    FIRE_RECORDS_100M_CODE & 0xff,
  );

  const fireBase = FIRE_RECORDS_100M;
  mem8[u16(fireBase + 0x00)] = 0x01;
  mem8[u16(fireBase + 0x20)] = 0x01; // the second record, one stride on
  // Gather two permuting hardware sprite records (base fireBase, dest M100_FIRE_SPRITE_PAIR, count 2,
  // stride 32). The gather leaves A/B/L/IX byte-faithful, no manual write.
  gatherSpriteRecords(m, 32, 0x02, M100_FIRE_SPRITE_PAIR & 0xff00, M100_FIRE_SPRITE_PAIR & 0xff, fireBase);

  // Terminal register live-outs the memory-equivalence gate compares: C/D/E/H reloaded here (A/B/L/IX
  // already left by the gather; H-only, since the gather leaves L, so writing HL would clobber L).
  regs.c = 0x1c;
  regs.de = 32;
  regs.h = (M100_FIRE_SPRITE_PAIR >> 8) & 0xff;
}
