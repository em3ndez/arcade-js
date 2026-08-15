// SPDX-License-Identifier: GPL-3.0-only
/**
 * initNewGameScoreAndTimers — new-game reset: zero the player-1 and player-2 score words and the
 * extra-life-awarded flags, then copy the start-time byte into both time-remaining bytes so both time
 * bars begin full. LIVE-OUT: memory-only.
 */
import { SHARED_TIME_BYTE, loc_83e5, PLAYER1_EXTRA_LIFE_AWARDED, PLAYER2_SCORE, PLAYER1_SCORE } from "./names.js";

export function initNewGameScoreAndTimers(m) {
  const { mem8, mem16 } = m;
  mem16[PLAYER1_SCORE] = 0;
  mem16[PLAYER2_SCORE] = 0;
  mem16[PLAYER1_EXTRA_LIFE_AWARDED] = 0;
  const startTime = mem8[SHARED_TIME_BYTE];
  mem16[loc_83e5] = (startTime << 8) | startTime;
}
