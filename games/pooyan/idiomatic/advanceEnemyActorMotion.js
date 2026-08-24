// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceEnemyVerticalAndDispatchByAltitude } from "./advanceEnemyVerticalAndDispatchByAltitude.js";
import { advanceTravelingEnemyToArrival } from "./advanceTravelingEnemyToArrival.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * advanceEnemyActorMotion — enemy actor state handler (rst-0x28 dispatch target) for the record at IX.
 *
 * First steps the record's animation player. Then, on odd frames of the round counter, it runs the
 * vertical mover; on even frames it hands off to the horizontal-travel handler.
 *
 * LIVE-OUT: none — a void state handler; all effect lands in the IX actor record and shared state.
 */
export function advanceEnemyActorMotion(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the animation player
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return advanceTravelingEnemyToArrival(m, rec); // even frame -> travel handler
  return advanceEnemyVerticalAndDispatchByAltitude(m, rec); // odd frame -> vertical mover
}
