// SPDX-License-Identifier: GPL-3.0-only
/**
 * initNewGameScoreAndTimers — new-game reset: zero the extra-life-awarded flags, the player-2 score
 * word, and the high-score word, then copy the start-time byte into both time-remaining bytes so both
 * time bars begin full. LIVE-OUT: memory-only.
 */
import { loc_83e4, loc_83e5, loc_83eb, loc_83ed } from "./names.js";

const EXTRA_LIFE_FLAGS = 0x83e7; // extra-life-awarded flag word (P1/P2 pair), zeroed at new-game start

export function initNewGameScoreAndTimers(m) {
  const { mem8, mem16 } = m;
  mem16[loc_83ed] = 0;
  mem16[loc_83eb] = 0;
  mem16[EXTRA_LIFE_FLAGS] = 0;
  const startTime = mem8[loc_83e4];
  mem16[loc_83e5] = (startTime << 8) | startTime;
}
