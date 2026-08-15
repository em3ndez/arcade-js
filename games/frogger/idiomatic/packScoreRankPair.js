// SPDX-License-Identifier: GPL-3.0-only
/**
 * packScoreRankPair — pack the player-2 score and the high score into the display field: rank the larger word
 * first and the smaller second through the score-rank helper, storing the larger's returned rank code
 * as the low byte and the smaller's as the high byte. LIVE-OUT: memory-only.
 */
import { loc_83eb, loc_83ed, loc_83fb } from "./names.js";
import { insertHighScoreEntry } from "./insertHighScoreEntry.js";

export function packScoreRankPair(m) {
  const { regs, mem16 } = m;
  const high = mem16[loc_83ed];
  const p2 = mem16[loc_83eb];
  const larger = p2 < high ? high : p2;
  const smaller = p2 < high ? p2 : high;

  regs.d = (larger >> 8) & 0xff;
  regs.e = larger & 0xff;
  insertHighScoreEntry(m);
  const largerRank = regs.a;

  regs.d = (smaller >> 8) & 0xff;
  regs.e = smaller & 0xff;
  insertHighScoreEntry(m);
  const smallerRank = regs.a;

  mem16[loc_83fb] = ((smallerRank << 8) | largerRank) & 0xffff;
}
