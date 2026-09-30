// SPDX-License-Identifier: GPL-3.0-only
/** advanceAttractTowardGameStart — guarded tail of the phase-3 image step: bail while play is active, else reset the
 * sub-step/phase on a pending flag, or on free-play + two input bits hide the sprites and start a game.
 * LIVE-OUT: memory only; the accumulator and flags the original leaves on each bail are read by nothing
 * after it. */
import { hideAllSprites } from "./hideAllSprites.js";
import { startGameOnFreePlay } from "./startGameOnFreePlay.js";
import { CREDIT_COUNT, FREE_PLAY, IN0_MIRROR, PLAY_ACTIVE, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, SEQUENCE_PHASE_ON_CREDIT } from "./names.js";

export function advanceAttractTowardGameStart(m) {
  const { mem8 } = m;

  if (mem8[PLAY_ACTIVE] !== 0) return;

  if (mem8[CREDIT_COUNT] !== 0) {
    mem8[SEQUENCE_SUBSTEP] = 0;
    mem8[SEQUENCE_PHASE] = mem8[SEQUENCE_PHASE_ON_CREDIT];
    return;
  }

  if (mem8[FREE_PLAY] === 0) return;
  if ((mem8[IN0_MIRROR] & 0x18) === 0) return;

  // hide the sprites, then start the game; the start is the tail, so its return is this arm's.
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}
