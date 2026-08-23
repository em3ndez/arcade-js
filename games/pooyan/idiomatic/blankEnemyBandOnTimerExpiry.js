// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * blankEnemyBandOnTimerExpiry — object state-10 handler.
 *
 * Steps the object's animation sequence, then counts down its frame timer. While the timer has not
 * elapsed the handler returns; once it reaches zero the object is retired by blanking its sprite band.
 *
 * LIVE-OUT: on the elapsed (band-blank) path HL = the pointer advanced past the blanked band and
 * B = 0, both set by the band blanker and inherited by the frozen dispatch. The not-elapsed path is
 * memory-only — the animation step leaves no register a caller consumes.
 */

const FRAME_TIMER_FIELD = 0x11; // record byte counted down each frame

export function blankEnemyBandOnTimerExpiry(m, ix = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, ix);

  const timer = (mem8[ix + FRAME_TIMER_FIELD] - 1) & 0xff;
  mem8[ix + FRAME_TIMER_FIELD] = timer;
  if (timer !== 0) return; // frame timer still running

  return blankActorSpriteBand(m, ix); // elapsed: blank the sprite band (sets HL + B)
}
