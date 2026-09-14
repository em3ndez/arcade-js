// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_DEPTH, POKEY2_RANDOM, ENEMY_FIRE_THRESHOLD, ENEMY_FIRE_SELECT } from "./names.js";
import { flipEnemyLaneTowardTarget, flipEnemyLaneRandomSide } from "./flipEnemyLaneTowardTarget.js";

/**
 * maybeFireEnemyStep — decide whether one enemy slot takes a flip-step this frame. ROM 0x9f5f.
 *
 * Role in the machine: per-frame, each active enemy slot is offered a chance to "fire" a
 * lane-hop -- the flipper's move from one tube lane to an adjacent one. This is the gate
 * that decides whether slot x hops now and, if so, which way it turns. Two things must be
 * true to hop: the slot must be armed (its depth cell's fire bit set) and a fresh random
 * draw must clear the difficulty threshold, so hopping is stochastic and paced by level.
 *
 * Behavior: reads the slot's depth/flags at $2df,x -- if the fire bit (0x20) is clear the
 * slot is not armed, return. Then draw the POKEY2 random ($60da); if it is below the
 * threshold cell $15f the draw fails this frame, return. Once past the gate, pick the turn
 * side: if the global select flag $159 has bit6 clear, or the slot index is even, hop to a
 * random side; only an odd slot with bit6 set aims the hop toward the player's segment.
 *
 * Live-out: none directly; it tail-calls flipEnemyLaneRandomSide or flipEnemyLaneTowardTarget,
 * which mutate the slot's turn side and lane. Grounding: [seen].
 */
export function maybeFireEnemyStep(m, x = m.regs.x) {
  const { mem8 } = m;
  if ((mem8[u16(ENEMY_DEPTH + x)] & 0x20) === 0) return;   // fire bit clear -- slot not armed
  if (mem8[POKEY2_RANDOM] < mem8[ENEMY_FIRE_THRESHOLD]) return;          // random below threshold -- no hop this frame
  if ((mem8[ENEMY_FIRE_SELECT] & 0x40) === 0) return flipEnemyLaneRandomSide(m, x);  // select bit6 clear -> random side
  if ((x & 1) === 0) return flipEnemyLaneRandomSide(m, x);            // even slot -> random side
  return flipEnemyLaneTowardTarget(m, x);                               // odd slot with bit6 set -> aim at player
}
