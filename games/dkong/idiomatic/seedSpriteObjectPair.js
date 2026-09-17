// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedSpriteObjectPair — seed two object records from fixed templates at a caller-given position
 * table, mark both active, and gather each into a 4-byte hardware sprite record. Every count is a
 * fixed two; only the position table (passed in through a pointer register) varies per call site.
 *
 * LIVE-OUT: memory-only.
 */

import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_PAIR_6680, OBJ_ACTIVE, OBJ_X, OBJ_SPRITE_CODE } from "./names.js";

export function seedSpriteObjectPair(m) {
  const { regs, mem8 } = m;

  // Step 1 — scatter the caller's position table (its pointer is the live-in) into both records' X/Y.
  regs.de = OBJ_PAIR_6680 + OBJ_X;
  regs.bc = 0x020e;
  copyBytePairsStrided(m);

  // Step 2 — stamp the shared appearance template into both records' code/attribute fields.
  regs.hl = 0x3e08;
  regs.de = OBJ_PAIR_6680 + OBJ_SPRITE_CODE;
  regs.bc = 0x020c;
  replicateGroupStrided(m);

  // Step 3 — mark both records active.
  regs.ix = OBJ_PAIR_6680;
  mem8[(regs.ix + OBJ_ACTIVE) & 0xffff] = 0x01;
  mem8[(regs.ix + 0x10 + OBJ_ACTIVE) & 0xffff] = 0x01;

  // Step 4 — gather each record into a consecutive 4-byte hardware sprite record.
  regs.hl = 0x6a18;
  regs.b = 0x02;
  regs.de = 0x0010;
  gatherSpriteRecords(m);
}
