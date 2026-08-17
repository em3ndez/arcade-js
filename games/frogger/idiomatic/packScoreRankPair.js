// SPDX-License-Identifier: GPL-3.0-only
/**
 * packScoreRankPair — pack both players' scores into the display field: rank the larger word first and
 * the smaller second through the score-rank helper, storing the larger's returned rank code as the low
 * byte and the smaller's as the high byte. LIVE-OUT: memory-only.
 */
import { PLAYER2_SCORE, PLAYER1_SCORE, INTRO_DIGIT_FIELD } from "./names.js";
import { insertHighScoreEntry } from "./insertHighScoreEntry.js";

export function packScoreRankPair(m) {
  const { mem16 } = m;
  const p1 = mem16[PLAYER1_SCORE];
  const p2 = mem16[PLAYER2_SCORE];
  const larger = p2 < p1 ? p1 : p2;
  const smaller = p2 < p1 ? p2 : p1;

  const largerRank = insertHighScoreEntry(m, (larger >> 8) & 0xff, larger & 0xff);
  const smallerRank = insertHighScoreEntry(m, (smaller >> 8) & 0xff, smaller & 0xff);

  mem16[INTRO_DIGIT_FIELD] = ((smallerRank << 8) | largerRank) & 0xffff;
}
