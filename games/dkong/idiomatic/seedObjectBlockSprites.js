// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectBlockSprites — a no-input board-setup coordinator: stamp a 4-byte template into the
 * OBJ_SPRITE_CODE field of the 10 OBJ_ARRAY_65 records (stride 0x10), then gather their permuted
 * fields (X<-+3, code<-+7, attr<-+8, Y<-+5) into 10 hardware sprite records at ACTOR_SPRITES.
 *
 * LIVE-OUT: memory-only — the 40 template-seed bytes and the 40 hardware sprite bytes.
 */

import { page } from "../../../core/int.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_65, ACTOR_SPRITES, OBJ_SPRITE_CODE, OBJ_ARRAY_65_TEMPLATE } from "./names.js";

export function seedObjectBlockSprites(m) {
  const { regs } = m;

  // Fill the +7 field of all ten records: 10 records, in-page gap 0x0C (record stride = gap + 4 = 0x10).
  const seedDest = OBJ_ARRAY_65 + OBJ_SPRITE_CODE;
  replicateGroupStrided(m, OBJ_ARRAY_65_TEMPLATE, 0x0c, page(seedDest), 0x0a, seedDest & 0xff);

  // base / dest / per-record stride ride the return so the frozen gather reads them off the bridge; C
  // (the record gap left in place) rides it too so the exit register file matches.
  return [regs.c = 0x0c, regs.ix = OBJ_ARRAY_65, regs.hl = ACTOR_SPRITES, regs.de = 16, gatherSpriteRecords(m, 16, 0x0a)];
}
