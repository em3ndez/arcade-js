// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * retireEnemyOnFrameTimerExpiry — per-frame object tick with a frame-timer countdown. Record base at IX.
 *
 * Steps the object's animation sequence, then counts down the +0x11 frame timer. While the timer is
 * still running it returns to the caller; once it elapses it hands the record to the sprite-band
 * blanker (tail).
 *
 * LIVE-OUT: none — both exits are memory-only (the animation step and, on expiry, the band blank).
 */

const FRAME_TIMER = 0x11; // rec: per-frame down-counter

export function retireEnemyOnFrameTimerExpiry(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // frame timer still running

  return blankActorSpriteBand(m, rec); // timer elapsed -> blank the sprite band
}
