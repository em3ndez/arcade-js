// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageActorSpriteRecords — stage the current actor's two hardware sprite records (its main body and
 * its shadow "twin") into the sprite buffer.
 *
 * Every object mover funnels here as its final act: after the move/collision pass updates the live
 * object record, this builds the two 4-byte sprite entries the display shows — landing in the last
 * two slots of the sprite buffer that the per-frame service copies wholesale into sprite memory. Each
 * record is three source bytes verbatim plus the fourth (its Y) with a shared dip-switch offset added
 * (0 in normal play). The two sources are the primary object record and its mirrored twin.
 */

import { ENEMY3_X, ENEMY3_TWIN_X, ENEMY3_SPRITE_SLOT, ENEMY3_TWIN_SPRITE_SLOT } from "./names.js";

// The shared vertical offset added to every staged sprite's Y (dip-switch param).
const SPRITE_Y_OFFSET = 0x8051;

/** Build one 4-byte sprite record from an object record: three bytes verbatim, then the fourth
 *  (the record's Y) with the shared offset added (kept to a byte). */
function stageRecord(m, srcBase, destSlot, yOffset) {
  const { mem8 } = m;
  mem8[destSlot] = mem8[srcBase];
  mem8[destSlot + 1] = mem8[srcBase + 1];
  mem8[destSlot + 2] = mem8[srcBase + 2];
  mem8[destSlot + 3] = mem8[srcBase + 3] + yOffset;
}

export function stageActorSpriteRecords(m) {
  const yOffset = m.mem8[SPRITE_Y_OFFSET];
  stageRecord(m, ENEMY3_X, ENEMY3_SPRITE_SLOT, yOffset); // primary body
  stageRecord(m, ENEMY3_TWIN_X, ENEMY3_TWIN_SPRITE_SLOT, yOffset); // shadow twin
}
