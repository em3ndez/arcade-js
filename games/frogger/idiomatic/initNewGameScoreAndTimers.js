// SPDX-License-Identifier: GPL-3.0-only
/**
 * initNewGameScoreAndTimers — new-game reset: zero the player-1 and player-2 score words and the
 * extra-life-awarded flags, then copy the start-time byte into both time-remaining bytes so both time
 * bars begin full. LIVE-OUT: memory-only.
 */
import { loc_83e4, loc_83e5, loc_83e7, loc_83eb, loc_83ed } from "./names.js";

export function initNewGameScoreAndTimers(m) {
  const { mem8, mem16 } = m;
  mem16[loc_83ed] = 0;
  mem16[loc_83eb] = 0;
  mem16[loc_83e7] = 0;
  const startTime = mem8[loc_83e4];
  mem16[loc_83e5] = (startTime << 8) | startTime;
}
