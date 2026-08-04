// SPDX-License-Identifier: GPL-3.0-only
/**
 * insertHighScore — place a candidate score into the descending three-entry
 * "BEST SCORES TODAY" table, bumping the entries it beats down a rank.  ROM 0x4d3a.
 *
 * The candidate score is a 16-bit value held as two bytes in work RAM (a high byte
 * and a low byte). The table holds three ranked slots, highest first; each slot is a
 * 5-byte record: three initials bytes followed by the 16-bit score. The routine walks
 * the table from the lowest rank up:
 *
 *   - A score that does not strictly beat the lowest entry never makes the table, and
 *     the routine returns having changed nothing.
 *   - Otherwise, for every entry the candidate beats, that entry (score AND initials)
 *     slides down one rank so the loser is preserved one place lower.
 *   - Where the candidate settles, its score is written and that slot's initials are
 *     stamped with the placeholder byte (the player will type real initials in later).
 *
 * Ties place the candidate just BELOW the equal entry — an equal score does not
 * displace one already on the board. The rank it landed at (1, 2 or 3) is published to
 * a result byte; the caller pre-clears that byte to 0, so "no placement" reads as 0.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4d3a.test.js.
 * GATE:     crafted-entry — attract never inserts a score, so a real booted machine is
 *           nudged across the score table's full input domain (no-placement / tie /
 *           land-at-each-rank / high-byte-tie low-byte compares + a randomized sweep),
 *           poked identically on both sides; teeth = a strict-`<` tie bug.
 * LIVE-OUT: memory-only — the three score slots, their initials, and the landed-rank
 *           byte. It takes no register inputs and the caller reads its result from RAM;
 *           the residual registers/flags are dead ABI (the RAM gate backstops that). It
 *           models no stack, so SP and the return address are left untouched.
 * NAMES:    the candidate score bytes 0x8031/0x8034 are SCORE_LO/SCORE_HI from names.js;
 *           the ranked table slots keep local names — no names.js name exists for them. The
 *           landed-rank byte 0x8048 is what names.js tentatively (weak) calls VARIANT for
 *           a different, round-setup role, so it is NOT imported here — using a wrong
 *           role name would mislead worse than a plain address.
 */

import { SCORE_HI, SCORE_LO } from "./names.js";

// The ranked table: rank 1 (top) at TABLE_TOP, then rank 2, rank 3, each a 5-byte
// record of [initial, initial, initial, score-low, score-high].
const TABLE_TOP = 0x8039;
const RANK_STRIDE = 5;

const LANDED_RANK = 0x8048; // set to the rank (1/2/3) the score landed at; 0 = no placement
const INITIALS_PLACEHOLDER = 0xff; // stamped over freed initials for the player to overwrite

const initialsAddr = (rank) => TABLE_TOP + RANK_STRIDE * (rank - 1);
const scoreAddr = (rank) => initialsAddr(rank) + 3;

/** Slide one rank's whole record (score + all three initials) down to a lower rank. */
function shiftRankDown(m, fromRank, toRank) {
  const { mem8, mem16 } = m;
  mem16[scoreAddr(toRank)] = mem16[scoreAddr(fromRank)];
  const from = initialsAddr(fromRank);
  const to = initialsAddr(toRank);
  mem8[to] = mem8[from];
  mem8[to + 1] = mem8[from + 1];
  mem8[to + 2] = mem8[from + 2];
}

/** Settle the candidate at a rank: write its score, record the rank, blank the initials. */
function landScoreAt(m, rank, score) {
  const { mem8, mem16 } = m;
  mem16[scoreAddr(rank)] = score;
  mem8[LANDED_RANK] = rank;
  const init = initialsAddr(rank);
  mem8[init] = INITIALS_PLACEHOLDER;
  mem8[init + 1] = INITIALS_PLACEHOLDER;
  mem8[init + 2] = INITIALS_PLACEHOLDER;
}

export function insertHighScore(m) {
  const { mem8, mem16 } = m;
  const candidate = (mem8[SCORE_HI] << 8) | mem8[SCORE_LO];

  // Must strictly beat the lowest entry to make the table at all.
  if (candidate <= mem16[scoreAddr(3)]) return;

  // Beats rank 3. If it does not also beat rank 2, it settles at the bottom rank.
  if (candidate <= mem16[scoreAddr(2)]) {
    landScoreAt(m, 3, candidate);
    return;
  }

  // Beats rank 2: the old rank-2 entry drops to rank 3, then test the top.
  shiftRankDown(m, 2, 3);
  if (candidate <= mem16[scoreAddr(1)]) {
    landScoreAt(m, 2, candidate);
    return;
  }

  // Beats rank 1 (the top): the old top drops to rank 2 and the candidate takes the crown.
  shiftRankDown(m, 1, 2);
  landScoreAt(m, 1, candidate);
}
