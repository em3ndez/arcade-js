// SPDX-License-Identifier: GPL-3.0-only
/**
 * packScoreRankPair — pack both players' scores into the display field: rank the larger word first and
 * the smaller second through the score-rank helper, storing the larger's returned rank code as the low
 * byte and the smaller's as the high byte. LIVE-OUT: memory-only.
 */
import { PLAYER2_SCORE, PLAYER1_SCORE, loc_83fb } from "./names.js";
import { insertHighScoreEntry } from "./insertHighScoreEntry.js";

export function packScoreRankPair(m) {
  const { regs, mem16 } = m;
  const p1 = mem16[PLAYER1_SCORE];
  const p2 = mem16[PLAYER2_SCORE];
  const larger = p2 < p1 ? p1 : p2;
  const smaller = p2 < p1 ? p2 : p1;

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
