// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { fireEnemyShotWhenAlignedWithPlayer } from "./fireEnemyShotWhenAlignedWithPlayer.js";
import { resetActorSubstateAndReloadStateTimer } from "./resetActorSubstateAndReloadStateTimer.js";
import { armActorDropAnimationNearTop } from "./armActorDropAnimationNearTop.js";

/**
 * advanceEnemyVerticalAndDispatchByAltitude — advance the enemy actor's vertical position along its velocity, then branch on state.
 *
 * The position low byte (+3) advances by the signed velocity (+0x0a), borrowing one from the high
 * byte (+4) on underflow. When the state byte (+7) is zero it delegates to the arrival-animation
 * step; otherwise a high position below 4 resets the sub-state and reloads the state timer, below
 * 0x10 simply returns, and at or above 0x10 it falls through to the fire/drop gate.
 *
 * LIVE-OUT: none — rets or tail-delegates; all effect lands in the IX actor record.
 */
export function advanceEnemyVerticalAndDispatchByAltitude(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const vel = mem8[rec + 0x0a];
  const posLow = mem8[rec + 0x03];
  if (posLow < u8(-vel)) mem8[rec + 0x04] = u8(mem8[rec + 0x04] - 1); // borrow into the high byte
  mem8[rec + 0x03] = u8(posLow + vel);

  const posHigh = mem8[rec + 0x04];
  if (mem8[rec + 0x07] === 0) return armActorDropAnimationNearTop(m, posHigh, rec);
  if (posHigh < 0x04) return resetActorSubstateAndReloadStateTimer(m, rec);
  if (posHigh < 0x10) return;
  return fireEnemyShotWhenAlignedWithPlayer(m, rec);
}
