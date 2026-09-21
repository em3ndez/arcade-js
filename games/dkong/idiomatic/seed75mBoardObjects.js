// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed75mBoardObjects — seed the 75m elevator board's object records and their hardware sprite
 * mirror from fixed templates. Takes no inputs: every source, count and constant is a fixed
 * immediate, so it always writes the same state. Seeds three object-record arrays (fires, actors,
 * and the board's six-record array), builds their sprite records in the sprite buffer, and copies
 * two fixed templates in.
 *
 * LIVE-OUT: memory-only — the three object-record arrays and the sprite records and template
 * copies they produce inside the sprite buffer.
 */

import { page, u16 } from "../../../core/int.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import {
  OBJ_ARRAY_64,
  OBJ_ARRAY_66,
  OBJECT_COLLISION_SPRITES,
  OBJ_STATE,
  OBJ_66_SPRITES,
  loc_6970,
  OBJ_ARRAY_64_TEMPLATE,
  OBJ_ARRAY_66_TEMPLATE,
  OBJ_ARRAY_66_POSITION_TABLE,
  COLLISION_SPRITES_TEMPLATE_75M,
  SPRITE_6970_TEMPLATE_75M,
} from "./names.js";

/** Forward block-copy of `count` bytes from `src` to `dst`. */
function blockCopy(mem8, dst, src, count) {
  for (let i = 0; i < count; i++) {
    mem8[u16(dst + i)] = mem8[u16(src + i)];
  }
}

export function seed75mBoardObjects(m) {
  const { mem8 } = m;

  const de1 = OBJ_ARRAY_64 + 0x07; // dest: +7 of the first fire record
  replicateGroupStrided(m, OBJ_ARRAY_64_TEMPLATE, 0x1c, page(de1), 0x05, de1 & 0xff); // 5 records, record stride 0x20

  seedObjectBlockSprites(m);

  for (let i = 0; i < 6; i++) mem8[u16(OBJ_ARRAY_66 + i * 0x10)] = 0x01;

  for (let i = 0; i < 3; i++) mem8[u16(OBJ_ARRAY_66 + OBJ_STATE + i * 0x10)] = 0x08;

  const de2 = OBJ_ARRAY_66 + 0x03; // dest base — each pair lands at +0 and +2 from here
  copyBytePairsStrided(m, OBJ_ARRAY_66_POSITION_TABLE, de2, 0x0e, 0x06); // 6 pairs, record stride 0x10

  const de3 = OBJ_ARRAY_66 + 0x07;
  replicateGroupStrided(m, OBJ_ARRAY_66_TEMPLATE, 0x0c, page(de3), 0x06, de3 & 0xff); // 6 records, record stride 0x10

  gatherSpriteRecords(m, 16, 0x06, page(OBJ_66_SPRITES), OBJ_66_SPRITES & 0xff, OBJ_ARRAY_66); // 6 records off the object-record base

  blockCopy(mem8, OBJECT_COLLISION_SPRITES, COLLISION_SPRITES_TEMPLATE_75M, 0x0c);

  const IX = OBJ_ARRAY_64;
  mem8[u16(IX + 0x00)] = 0x01;
  mem8[u16(IX + 0x03)] = 0x58;
  mem8[u16(IX + 0x0e)] = 0x58;
  mem8[u16(IX + 0x05)] = 0x80;
  mem8[u16(IX + 0x0f)] = 0x80;
  mem8[u16(IX + 0x20)] = 0x01;
  mem8[u16(IX + 0x23)] = 0xeb;
  mem8[u16(IX + 0x2e)] = 0xeb;
  mem8[u16(IX + 0x25)] = 0x60;
  mem8[u16(IX + 0x2f)] = 0x60;

  blockCopy(mem8, loc_6970, SPRITE_6970_TEMPLATE_75M, 0x10);
}
