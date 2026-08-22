// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { loc_3553 } from "./loc_3553.js";
/**
 * loc_3d8f — object state-4 handler.
 *
 * Steps the object's animation sequence, then counts down its frame timer. While the timer has not
 * elapsed the handler returns; once it reaches zero the object is retired by blanking its sprite band.
 *
 * LIVE-OUT: on the elapsed (band-blank) path HL = the pointer advanced past the blanked band and
 * B = 0, both set by the band blanker and inherited by the frozen dispatch. The not-elapsed path is
 * memory-only — the animation step leaves no register a caller consumes.
 */

const FRAME_TIMER_FIELD = 0x11; // record byte counted down each frame

export function loc_3d8f(m, ix = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, ix);

  const timer = (mem8[ix + FRAME_TIMER_FIELD] - 1) & 0xff;
  mem8[ix + FRAME_TIMER_FIELD] = timer;
  if (timer !== 0) return; // frame timer still running

  return loc_3553(m, ix); // elapsed: blank the sprite band (sets HL + B)
}
