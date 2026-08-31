// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceFallingEnemyAndTallyCatchOnLanding } from "./advanceFallingEnemyAndTallyCatchOnLanding.js";
/**
 * advanceObjectStateOnFrameTimerExpiry — object state-14 handler.
 *
 * Ticks the record's animation, then counts down its frame timer and returns while it is
 * still running. On expiry it advances the record's state byte and falls through into the
 * next state handler.
 *
 * LIVE-OUT: none — memory only; the fall-through delegate yields nothing the caller reads.
 */
const FRAME_TIMER = 0x11; // record: down-counter gating the state advance
const STATE_FIELD = 0x02; // record: state byte advanced on expiry

export function advanceObjectStateOnFrameTimerExpiry(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // tick the animation

  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // still counting down

  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
  return advanceFallingEnemyAndTallyCatchOnLanding(m, rec); // fall through into the next state handler
}
