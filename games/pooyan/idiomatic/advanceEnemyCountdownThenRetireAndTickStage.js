// SPDX-License-Identifier: GPL-3.0-only
import {
  ACTIVE_ENEMY_COUNT,
  STAGE_COUNTDOWN,
  SPAWN_PHASE_COUNTER,
  PLAY_STATE_INDEX,
  HUD_STAGE_DIGIT_LO,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";

/**
 * advanceEnemyCountdownThenRetireAndTickStage — advance one object's fine/coarse position countdown, and on rollover retire it.
 *
 * First steps the object's animation. It then adds the signed step (+0x0a) to the fine position
 * (+0x05), borrowing from the coarse counter (+0x06) when the fine value would underflow. While the
 * coarse counter is still non-zero it returns.
 *
 * On coarse rollover it blanks the object's sprite band and does the retire bookkeeping: decrement
 * the active-enemy count; decrement the stage countdown when it is non-zero; in play-state 4 bump
 * the spawn-phase counter; and, when the pre-decrement countdown minus one is below 0x0a, mirror
 * that value into the low HUD stage digit.
 *
 * LIVE-OUT: memory only — the object record plus the retire counters; no register output is consumed.
 */

const REC_FINE = 0x05; //   record: fine sub-position
const REC_COARSE = 0x06; // record: coarse counter
const REC_STEP = 0x0a; //   record: signed step
const HUD_DIGIT_CAP = 0x0a; // countdown-1 below this is shown

export function advanceEnemyCountdownThenRetireAndTickStage(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  const step = mem8[rec + REC_STEP];
  const negStep = (0x100 - step) & 0xff;
  const fine = mem8[rec + REC_FINE];
  if (fine < negStep) mem8[rec + REC_COARSE] = mem8[rec + REC_COARSE] - 1; // borrow (write wraps to a byte)
  mem8[rec + REC_FINE] = fine + step;

  if (mem8[rec + REC_COARSE] !== 0) return; // coarse counter still running

  blankActorSpriteBand(m, rec);

  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;

  const countdown = mem8[STAGE_COUNTDOWN];
  if (countdown !== 0) mem8[STAGE_COUNTDOWN] = countdown - 1;

  if (mem8[PLAY_STATE_INDEX] === 0x04) {
    mem8[SPAWN_PHASE_COUNTER] = mem8[SPAWN_PHASE_COUNTER] + 1;
  }

  const digit = (countdown - 1) & 0xff;
  if (digit >= HUD_DIGIT_CAP) return;
  mem8[HUD_STAGE_DIGIT_LO] = digit;
}
