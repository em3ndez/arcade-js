// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, COORD_LIST_PTR_HI, LANE_SCORE_INDEX_TABLE } from "./names.js";
import { insertObjectFromSlotDepth } from "./insertObjectFromSlotDepth.js";
import { retireEnemyAndSpawnSplit } from "./retireEnemyAndSpawnSplit.js";
import { addBcdScoreAndAwardAtThreshold } from "./addBcdScoreAndAwardAtThreshold.js";

// Seed COORD_LIST_PTR_HI for slot Y (the ENEMY_SEGMENT,y entry, decremented into the low nibble when the slot
// descriptor ENEMY_SLOT_FLAGS,y has both top bits set), retire that slot and spawn its replacement, then
// tail-delegate the score award selected by the slot's lane (a score-select table indexed by ENEMY_SLOT_FLAGS,y & 7).
export function respawnEnemyAndAward(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  const slotDesc = mem8[u16(ENEMY_SLOT_FLAGS + y)];
  let seated = mem8[u16(ENEMY_SEGMENT + y)];
  if ((slotDesc & 0xc0) === 0xc0) seated = (seated - 1) & 0x0f;
  mem8[COORD_LIST_PTR_HI] = seated;

  insertObjectFromSlotDepth(m, 0, x, y);
  retireEnemyAndSpawnSplit(m, y, x);

  // Re-read the descriptor: the spawn above can have reused the just-freed slot.
  const lane = mem8[u16(ENEMY_SLOT_FLAGS + y)] & 0x07;
  const scoreIndex = mem8[LANE_SCORE_INDEX_TABLE + lane];
  return addBcdScoreAndAwardAtThreshold(m, scoreIndex);
}
