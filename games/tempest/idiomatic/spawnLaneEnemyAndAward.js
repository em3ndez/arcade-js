// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { COORD_LIST_PTR_HI, SLOT_LOOP_INDEX, ENEMY_SEGMENT, HIT_TALLY, POKEY2_RANDOM } from "./names.js";
import { insertObjectFromSlotDepth } from "./insertObjectFromSlotDepth.js";
import { retireEnemyAndSpawnSplit } from "./retireEnemyAndSpawnSplit.js";
import { addBcdScoreAndAwardAtThreshold } from "./addBcdScoreAndAwardAtThreshold.js";

/**
 * spawnLaneEnemyAndAward — bring a new lane enemy on-screen in slot X and pay the score for it. ROM 0xa309.
 *
 * Role in the machine: this is the band-4 arm of the proximity resolver (resolveSlotProximityInteractions):
 * when a far slot's distance lands in the spawn band, the tube wants a fresh enemy to appear on that lane and
 * the player to be credited. This routine performs both halves — it activates the enemy slot, chooses its
 * geometry and animation variant, threads it through the insert/retire chain, and awards the BCD points.
 *
 * Behavior: it saves the slot index X in SLOT_LOOP_INDEX (a shared scratch the chain routines read back), then
 * marks slot X live by writing 0xff into HIT_TALLY,x. The lane is (Y-4): that index into the ENEMY_SEGMENT
 * table gives the geometry byte, stored into COORD_LIST_PTR_HI so the insert routine knows which lane shape to
 * lay down. A cheap random variant is drawn from POKEY2_RANDOM's low three bits, clamped to 0..2 — any value
 * of 3 or higher collapses to 0 — giving `clamp`. That clamp selects both the object-insert depth class
 * (clamp+2) and the score tier (clamp+5). It then runs insertObjectFromSlotDepth to place the object,
 * retireEnemyAndSpawnSplit to fold the old lane occupant and spawn any split, and finally
 * addBcdScoreAndAwardAtThreshold to add the tier's points and grant a bonus life at the threshold.
 *
 * Live-out: HIT_TALLY,x = 0xff (slot live), COORD_LIST_PTR_HI = lane geometry byte, SLOT_LOOP_INDEX = X
 * (left unchanged for the caller), plus whatever object/enemy/score state the three chained helpers mutate.
 * Grounding: [seen].
 */
export function spawnLaneEnemyAndAward(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  mem8[SLOT_LOOP_INDEX] = x;          // publish X for the insert/retire chain to read back
  mem8[u16(HIT_TALLY + x)] = 0xff;    // mark enemy slot X live

  const laneIndex = u8(y - 4);        // Y is a 4-based slot handle; the lane table is 0-based
  mem8[COORD_LIST_PTR_HI] = mem8[u16(ENEMY_SEGMENT + laneIndex)]; // stash the lane's geometry byte

  const masked = mem8[POKEY2_RANDOM] & 0x07; // cheap variant seed from the sound chip's noise register
  const clamp = masked < 3 ? masked : 0;     // keep only 0..2; 3..7 fold to 0

  insertObjectFromSlotDepth(m, clamp + 2, x, laneIndex); // place the object at the variant's depth class
  retireEnemyAndSpawnSplit(m, laneIndex, x);             // fold the prior lane occupant / spawn a split
  addBcdScoreAndAwardAtThreshold(m, clamp + 5);          // credit the variant's score tier (+ bonus-life check)
}
