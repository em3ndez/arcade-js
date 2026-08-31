// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { latchColumnLimitAndArmTurnAnimation } from "./latchColumnLimitAndArmTurnAnimation.js";
import { clearColumnLimitAndArmTurnAnimation } from "./clearColumnLimitAndArmTurnAnimation.js";
/**
 * countdownThenRearmTurnAnimationByFlag — object state handler.
 *
 * Steps the record's animation sequencer, then counts down its phase timer and returns until it
 * lapses. On lapse it advances the state field and re-arms the turn animation: the bit0-clear
 * variant when the record's flag byte is even, otherwise the bit0-set variant.
 *
 * LIVE-OUT: none consumed (memory only). All callees are memory-only; the scratch
 * registers (A and flags) are not read back by the dispatcher.
 */

const PHASE_TIMER = 0x11; //     record offset: the down-counter gating the state step
const STATE_FIELD = 0x02; //     record offset: the state byte advanced on lapse
const VARIANT_FLAG = 0x08; //    record offset: bit0 selects which turn animation to arm
const BIT0 = 0x01;

export function countdownThenRearmTurnAnimationByFlag(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  mem8[rec + PHASE_TIMER] = (mem8[rec + PHASE_TIMER] - 1);
  if (mem8[rec + PHASE_TIMER] !== 0) return; // timer still running

  mem8[rec + STATE_FIELD] = (mem8[rec + STATE_FIELD] - 1);
  if ((mem8[rec + VARIANT_FLAG] & BIT0) === 0) return latchColumnLimitAndArmTurnAnimation(m, rec);
  return clearColumnLimitAndArmTurnAnimation(m, rec);
}
