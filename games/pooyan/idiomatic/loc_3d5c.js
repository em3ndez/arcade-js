// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_3d99 } from "./loc_3d99.js";
import { loc_3d8f } from "./loc_3d8f.js";
import { COUNTDOWN_EXPIRE_DISPLAY_CMD, ANIM_SEQ_TABLE_3E49 } from "./names.js";
/**
 * loc_3d5c — object state-3 handler (dispatch index 3, also fall-through
 * from the state-2 handler). Record base at IX. Steps the animation, counts down the frame timer, and on expiry
 * advances the phase (7 -> turn/select; 4 -> swap animation + reseed), bumps the phase-count and
 * state, and falls through into the state-4 handler.
 *
 * LIVE-OUT: none — every reachable exit is memory-only (the fall-through always hits the state-4
 * handler's not-elapsed path, the timer already spent; the turn/select handler declares none; the
 * early return is memory-only).
 */

const FRAME_TIMER = 0x11; //   rec: per-frame down-counter
const ANIM_PHASE = 0x16; //    rec: animation phase read/tested
const PHASE_COUNT = 0x13; //   rec: gets phase+1
const STATE_FIELD = 0x02; //   rec: object state byte
const TURN_PHASE = 0x07;
const SWAP_PHASE = 0x04;
const RESEED_TIMER = 0x30;

export function loc_3d5c(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // step the animation sequence

  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // frame timer still running

  const phase = mem8[rec + ANIM_PHASE];
  if (phase === TURN_PHASE) return loc_3d99(m, rec);

  const bias = phase === 0 ? 0 : (phase - 1) & 0xff; // display-cmd low-byte bias
  loc_0038(m, COUNTDOWN_EXPIRE_DISPLAY_CMD + bias);

  if (phase === SWAP_PHASE) {
    const animPtr = loc_0c45(m, phase, ANIM_SEQ_TABLE_3E49);
    setActorAnimation(m, rec, animPtr);
    mem8[rec + FRAME_TIMER] = RESEED_TIMER;
  }

  mem8[rec + PHASE_COUNT] = phase + 1; // write truncates
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
  return loc_3d8f(m, rec); // fall through into the state-4 handler
}
