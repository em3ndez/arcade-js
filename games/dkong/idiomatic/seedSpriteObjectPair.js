// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedSpriteObjectPair — seed two object records from fixed templates at a caller-given position
 * table, mark both active, and gather each into a 4-byte hardware sprite record. Every count is a
 * fixed two; only the position table (passed in through a pointer register) varies per call site.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_PAIR_6680, OBJ_ACTIVE, OBJ_X, OBJ_SPRITE_CODE, HAMMER_OBJ1_SPRITE_RECORD } from "./names.js";

export function seedSpriteObjectPair(m, src = m.regs.hl) {
  const { mem8 } = m;

  // Step 1 — scatter the caller's position table (its pointer, src, is the live-in) into both records' X/Y.
  copyBytePairsStrided(m, src, OBJ_PAIR_6680 + OBJ_X, 0x0e, 0x02);

  // Step 2 — stamp the shared appearance template into both records' code/attribute fields.
  const codeDest = OBJ_PAIR_6680 + OBJ_SPRITE_CODE;
  replicateGroupStrided(m, 0x3e08, 0x0c, codeDest & 0xff00, 0x02, codeDest & 0xff);

  // Step 3 — mark both records active.
  const objBase = OBJ_PAIR_6680;
  mem8[u16(objBase + OBJ_ACTIVE)] = 0x01;
  mem8[u16(objBase + 0x10 + OBJ_ACTIVE)] = 0x01;

  // Step 4 — gather each record into a consecutive 4-byte hardware sprite record.
  gatherSpriteRecords(m, 0x0010, 0x02, HAMMER_OBJ1_SPRITE_RECORD & 0xff00, HAMMER_OBJ1_SPRITE_RECORD & 0xff, objBase);
}
