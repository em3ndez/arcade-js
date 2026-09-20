// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed25mBoardObjects — stamp the 25m board's initial object records and sprite shadows from fixed
 * templates. Straight-line initialisation of block copies and strided group replications; each
 * callee reads its source/dest/count from the register file staged before the call.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import {
  OBJ_ARRAY_64,
  OBJ_ARRAY_67,
  OBJ_ARRAY_67_PAGE68,
  BONUS_COUNTDOWN_SPRITES,
  loc_69fc,
  BONUS_COUNTDOWN_SPRITES_TEMPLATE,
  OBJ_ARRAY_64_TEMPLATE,
  OBJ_RECORD_66A0_TEMPLATE_25M,
  SPRITE_69FC_TEMPLATE_25M,
  OBJ_PAIR_6680_POSITION_TABLE_25M,
  OBJ_ARRAY_67_TEMPLATE,
} from "./names.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

function blockCopy(mem8, src, dst, len) {
  for (let i = 0; i < len; i++) {
    mem8[u16(dst + i)] = mem8[u16(src + i)];
  }
}

export function seed25mBoardObjects(m) {
  const { mem8 } = m;

  blockCopy(mem8, BONUS_COUNTDOWN_SPRITES_TEMPLATE, BONUS_COUNTDOWN_SPRITES, 0x10);

  replicateGroupStrided(m, OBJ_ARRAY_64_TEMPLATE, 0x1c, OBJ_ARRAY_64, 0x05, 0x07);

  loc_11fa(m, OBJ_RECORD_66A0_TEMPLATE_25M);

  blockCopy(mem8, SPRITE_69FC_TEMPLATE_25M, loc_69fc, 0x04);

  seedSpriteObjectPair(m, OBJ_PAIR_6680_POSITION_TABLE_25M);

  replicateGroupStrided(m, OBJ_ARRAY_67_TEMPLATE, 0x1c, OBJ_ARRAY_67, 0x08, 0x07);
  replicateGroupStrided(m, OBJ_ARRAY_67_TEMPLATE, 0x1c, OBJ_ARRAY_67_PAGE68, 0x02, 0x07);
}
