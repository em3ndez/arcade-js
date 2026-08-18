// SPDX-License-Identifier: GPL-3.0-only
/**
 * packScoreRankPair  —  ROM 0x0f69  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The "did you make the high-score table?" recorder, run once when a game ends and the machine falls
 *   back to attract. It takes both players' final score words, files each one into Frogger's five-entry
 *   high-score ranking table, and remembers where each landed so the attract SCORE RANKING screen can
 *   flag the players' rows. The two score words are ranked LARGER FIRST, SMALLER SECOND — the order
 *   matters, see the ranking step below.
 *
 * WHERE IT SITS
 *   Called at cold-start new-game init from coldStartClearPlayRamAndSetMode (ROM 0x0567) as one of the
 *   credit/score-rank/header setup callees, alongside renderCreditLine and renderScoreHeader. It does
 *   two things in sequence: it MUTATES the ranking table (through insertHighScoreEntry, ROM 0x0a84,
 *   which slides losers down and drops each key into its slot), and it stashes the two returned rank
 *   codes in the packed field INTRO_DIGIT_FIELD (0x83fb). Downstream, placeScoreRankMarkers (ROM 0x0c3d)
 *   reads that field and stamps a marker tile beside the matching rows on the attract ranking screen.
 *   Grounding is [seen,poked]: the code path is confirmed and the score words were poked in the
 *   equivalence harness to exercise every ordering.
 *
 * LIVE-OUT
 *   Memory only. The rank helper edits the table at RAM 0x83f1..0x83fa, and this routine writes the
 *   packed rank-code pair to INTRO_DIGIT_FIELD (0x83fb/0x83fc). It returns nothing.
 */
import { PLAYER2_SCORE, PLAYER1_SCORE, INTRO_DIGIT_FIELD } from "./names.js";
import { insertHighScoreEntry } from "./insertHighScoreEntry.js";

export function packScoreRankPair(m) {
  const { mem16 } = m;

  // ── Read both players' final scores ───────────────────────────────────────────────────
  // Each score is a 16-bit word: PLAYER1_SCORE at 0x83ed, PLAYER2_SCORE at 0x83eb (they sit one word
  // apart in the score block). These are the end-of-game totals to be ranked against the table.
  const p1Score = mem16[PLAYER1_SCORE];
  const p2Score = mem16[PLAYER2_SCORE];

  // ── Order them larger-then-smaller ────────────────────────────────────────────────────
  // The ROM ranks the larger score first. The comparison is `p2 < p1`, so on a TIE (and in a one-player
  // game where p2 stays 0) p2 is treated as the larger — that tie-break is part of the observable
  // behaviour and is preserved exactly.
  const p1Bigger = p2Score < p1Score;
  const larger = p1Bigger ? p1Score : p2Score;
  const smaller = p1Bigger ? p2Score : p1Score;

  // ── File each score into the ranking table, larger first ──────────────────────────────
  // insertHighScoreEntry (ROM 0x0a84) inserts one key into the five-slot descending table and returns
  // its rank code in A (0 = below every slot, else 4·(slots it beat)+1, so a top insert returns 17 and
  // a last-slot insert returns 1). The high/low bytes of the score word are the key: (word >> 8) & 0xff
  // is the key-high (Z80 D), word & 0xff the key-low (Z80 E) — passed explicitly so the call is
  // register-free rather than reading DE.
  //
  // ORDER IS LOAD-BEARING: the call MUTATES the table, so the second insert ranks the smaller score
  // against a table that already contains the larger one. Ranking larger-first is what gives both
  // scores their correct final positions when both make the table.
  const largerRank = insertHighScoreEntry(m, (larger >> 8) & 0xff, larger & 0xff);
  const smallerRank = insertHighScoreEntry(m, (smaller >> 8) & 0xff, smaller & 0xff);

  // ── Pack the two rank codes into the display field ────────────────────────────────────
  // INTRO_DIGIT_FIELD is a two-byte cell (low byte 0x83fb, high byte 0x83fc). mem16 is little-endian, so
  // this stores the LARGER score's rank code in the low byte (0x83fb) and the SMALLER's in the high byte
  // (0x83fc). placeScoreRankMarkers later reads each byte and, when non-zero, stamps a marker at screen
  // position (48 − code): the rank is encoded as a POSITION, not a rendered numeral, so these are codes
  // and not digits despite the field's generic "intro digit" name.
  mem16[INTRO_DIGIT_FIELD] = (smallerRank << 8) | largerRank;
}
