// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { INTRO_DELAY_CKSUM_WORD, HIT_TALLY, PLAY_STATE_INDEX } from "./names.js";
/**
 * loc_705f — level-intro phase 6 (final): count the intro delay down and hand the round to play.
 *
 * Decrements the intro delay counter; while it is still non-zero the routine returns, holding the
 * round in its intro delay. When the delay reaches zero it silences the sound channel, clears the
 * running target-hit tally, and seats the play sub-state index to its play-ready value.
 *
 * LIVE-OUT: memory only — a tail-dispatched intro-phase handler; the dispatcher consumes none of
 * the registers it leaves.
 */

const PLAY_READY_STATE = 0x06; // play sub-state seated once the round is ready to run
const TALLY_CLEARED = 0x00; //   hit tally reset for the fresh round

export function loc_705f(m) {
  const { mem8 } = m;

  mem8[INTRO_DELAY_CKSUM_WORD] = mem8[INTRO_DELAY_CKSUM_WORD] - 1;
  if (mem8[INTRO_DELAY_CKSUM_WORD] !== 0) return;

  queueSoundCommand00(m);
  mem8[HIT_TALLY] = TALLY_CLEARED;
  mem8[PLAY_STATE_INDEX] = PLAY_READY_STATE;
}
