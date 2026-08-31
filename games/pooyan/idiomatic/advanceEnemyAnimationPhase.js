// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankEnemyBandOnTimerExpiry } from "./blankEnemyBandOnTimerExpiry.js";
import { COUNTDOWN_EXPIRE_DISPLAY_CMD, ANIM_SEQ_TABLE_3E49 } from "./names.js";
/**
 * advanceEnemyAnimationPhase — object state-9 handler (dispatch index 9, also fall-through
 * from armEnemyState8Animation). Record base at IX. Steps the animation, counts down the frame timer, and on expiry
 * advances the phase (7 -> turn/select; 4 -> swap animation + reseed), bumps the phase-count and
 * state, and falls through into the state-10 handler.
 *
 * LIVE-OUT: none — every reachable exit is memory-only (the fall-through always hits the state-10
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

export function advanceEnemyAnimationPhase(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // frame timer still running

  const phase = mem8[rec + ANIM_PHASE];
  if (phase === TURN_PHASE) return armEnemyTurnAnimation(m, rec);

  const bias = phase === 0 ? 0 : (phase - 1) & 0xff; // display-cmd low-byte bias
  enqueueDisplayCommand(m, COUNTDOWN_EXPIRE_DISPLAY_CMD + bias);

  if (phase === SWAP_PHASE) {
    const animPtr = fetchWordFromTableIndex(m, phase, ANIM_SEQ_TABLE_3E49);
    setActorAnimation(m, rec, animPtr);
    mem8[rec + FRAME_TIMER] = RESEED_TIMER;
  }

  mem8[rec + PHASE_COUNT] = phase + 1; // write truncates
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
  return blankEnemyBandOnTimerExpiry(m, rec); // fall through into the state-10 handler
}
