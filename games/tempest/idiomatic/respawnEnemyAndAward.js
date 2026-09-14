// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, COORD_LIST_PTR_HI, LANE_SCORE_INDEX_TABLE } from "./names.js";
import { insertObjectFromSlotDepth } from "./insertObjectFromSlotDepth.js";
import { retireEnemyAndSpawnSplit } from "./retireEnemyAndSpawnSplit.js";
import { addBcdScoreAndAwardAtThreshold } from "./addBcdScoreAndAwardAtThreshold.js";

/**
 * respawnEnemyAndAward -- retire an enemy, spawn its replacement, and award the kill. ROM 0xa398.
 *
 * Role in the machine: when the player kills an enemy (or a slot times out), the game removes it, may
 * put a fresh climber in its place, and pays out the score for the type destroyed. This routine is the
 * glue: it seats the coordinate-list anchor for the doomed slot, runs the retire/spawn chain, then
 * tail-calls the BCD score-award selected by the slot's lane. It is reached from activateSlotAndRespawn
 * (0xa38e) and the timed sweep (0xa888).
 *
 * Behavior: read the slot descriptor ENEMY_SLOT_FLAGS,y ($283,y) and the seated segment ENEMY_SEGMENT,y
 * ($2b9,y). If the descriptor has both top bits set (0xc0), step the seated segment back by one into the
 * low nibble (& 0x0f wrap) -- this is the split/offset case. Write that into COORD_LIST_PTR_HI ($2d, the
 * list anchor high byte). Insert the object from its slot depth, then run retireEnemyAndSpawnSplit for the
 * slot. Because that chain can reuse the just-freed slot, re-read ENEMY_SLOT_FLAGS,y for the lane (& 7),
 * look the lane up in the score-select table LANE_SCORE_INDEX_TABLE ($a3c5), and tail-delegate the award.
 *
 * Live-out: COORD_LIST_PTR_HI seeded; the slot is retired/respawned by the sub-chain; the score award is
 * applied by addBcdScoreAndAwardAtThreshold (whose return is this routine's return). Grounding: seen.
 */
export function respawnEnemyAndAward(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  const slotDesc = mem8[u16(ENEMY_SLOT_FLAGS + y)]; // $283,y descriptor
  let seated = mem8[u16(ENEMY_SEGMENT + y)];        // $2b9,y seated segment
  if ((slotDesc & 0xc0) === 0xc0) seated = (seated - 1) & 0x0f; // split case: step back into low nibble
  mem8[COORD_LIST_PTR_HI] = seated;                 // seed the list anchor high byte $2d

  insertObjectFromSlotDepth(m, 0, x, y);
  retireEnemyAndSpawnSplit(m, y, x);

  // Re-read the descriptor: the spawn above can have reused the just-freed slot.
  const lane = mem8[u16(ENEMY_SLOT_FLAGS + y)] & 0x07;        // lane = descriptor low 3 bits
  const scoreIndex = mem8[LANE_SCORE_INDEX_TABLE + lane];     // $a3c5[lane] -> score selector
  return addBcdScoreAndAwardAtThreshold(m, scoreIndex);
}
