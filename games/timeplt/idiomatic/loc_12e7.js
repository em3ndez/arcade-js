// SPDX-License-Identifier: GPL-3.0-only
/** loc_12e7 — decide whether the turn passes to the other player or the sequence simply steps on.
 * The active-player index picks the OTHER player's saved lives count, and a non-zero count is the
 * whole condition: somebody else is still in the game, so the turn is handed over. A zero count
 * ends the choice and the inner sequence index advances by one instead. This file writes no cell
 * of its own. LIVE-OUT: memory-only. */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { handPlayOverToOtherPlayer } from "./handPlayOverToOtherPlayer.js";
import { ACTIVE_PLAYER, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES } from "./names.js";

const FIRST = 0;

export function loc_12e7(m) {
  const { mem8 } = m;
  const otherPlayerLives = mem8[ACTIVE_PLAYER] === FIRST ? PLAYER_TWO_LIVES : PLAYER_ONE_LIVES;
  if (mem8[otherPlayerLives] !== 0) return handPlayOverToOtherPlayer(m);
  advanceSequenceSubStep(m);
}
