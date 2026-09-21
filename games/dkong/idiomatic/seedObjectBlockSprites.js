// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectBlockSprites — a no-input board-setup coordinator: stamp a 4-byte template into the
 * OBJ_SPRITE_CODE field of the 10 OBJ_ARRAY_65 records (stride 0x10), then gather their permuted
 * fields (X<-+3, code<-+7, attr<-+8, Y<-+5) into 10 hardware sprite records at ACTOR_SPRITES.
 *
 * LIVE-OUT: memory-only — the 40 template-seed bytes and the 40 hardware sprite bytes.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_65, ACTOR_SPRITES, OBJ_SPRITE_CODE, OBJ_ARRAY_65_TEMPLATE } from "./names.js";

export function seedObjectBlockSprites(m) {
  const { regs } = m;

  regs.de = OBJ_ARRAY_65 + OBJ_SPRITE_CODE; // dest: the +7 field of the first record
  regs.bc = 0x0a0c; // 0x0A records; stride byte 0x0C (record stride = this + 4 = 0x10)
  replicateGroupStrided(m, OBJ_ARRAY_65_TEMPLATE);

  // base / dest / per-record stride ride the return so the frozen gather reads them off the bridge.
  return [regs.ix = OBJ_ARRAY_65, regs.hl = ACTOR_SPRITES, regs.de = 0x0010, gatherSpriteRecords(m, 0x0010, 0x0a)];
}
