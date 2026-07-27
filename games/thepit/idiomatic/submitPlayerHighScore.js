// SPDX-License-Identifier: GPL-3.0-only
/**
 * submitPlayerHighScore — offer the finishing player's final score to the "BEST
 * SCORES TODAY" table and repaint the score readouts.  ROM 0x4cbf.
 *
 * Run once per player at end-of-round teardown. The caller selects which player is
 * finishing (by the selected-player byte), calls this, then reads back the landed-rank
 * result to decide whether that player earned a place and should enter their initials.
 *
 * The work, in order:
 *   - Start the landed-rank result at "did not place" (0). If the score fails to make
 *     the table the insert leaves it untouched, so it must read 0 going in — this is
 *     the one thing this routine does before delegating.
 *   - Make the selected player's saved score the live shared score, so the insert reads
 *     that player's number.
 *   - Offer the score to the three-entry high-score table: if it beats an entry it is
 *     placed, the beaten entries slide down a rank, and the rank it landed at (1/2/3)
 *     is recorded in the result byte.
 *   - Repaint the three on-screen score readouts from the now-updated table (the "BEST
 *     SCORES TODAY" records ARE the readout source records), so a fresh placement shows.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4cbf.test.js.
 * GATE:     crafted-entry — end-of-round teardown never runs in attract, so 0x4cbf is
 *           never dispatched (0 over 3000 attract frames); the gate runs it from a real
 *           captured attract state with the selected player, that player's score, and
 *           the table poked identically on both sides across placement / no-placement /
 *           tie / land-at-each-rank arms. RAM-only diff (the oracle tail-returns to its
 *           caller, so its pc/SP and the dead stack scratch below the entry pointer are
 *           excluded; every real write lives far below the stack page). Teeth: a twin
 *           that skips the landed-rank pre-clear, one that skips the repaint, and one
 *           that repaints before inserting.
 * LIVE-OUT: memory-only — the landed-rank result byte, the high-score table (scores +
 *           initials), the refreshed shared player block, and the readout display cells.
 *           The caller reads the result from RAM; no register or flag is live out.
 * NAMES:    LANDED_RANK (0x8048) is a local, NOT ram.js's tentative (weak) VARIANT —
 *           that name is a different, round-setup role, and a wrong role name would
 *           mislead worse than a plain address (same call the insert makes). The player
 *           block, high-score table, and readout cells are named inside the callees.
 */

import { loadPlayerState } from "./loadPlayerState.js";
import { insertHighScore } from "./insertHighScore.js";
import { renderScoreReadouts } from "./renderScoreReadouts.js";

const LANDED_RANK = 0x8048; // rank (1/2/3) the score placed at; 0 = it did not make the table

export function submitPlayerHighScore(m) {
  const { mem8 } = m;

  // "Did not place" until the insert proves otherwise.
  mem8[LANDED_RANK] = 0;

  loadPlayerState(m); // bring the finishing player's saved score into the live shared slot
  insertHighScore(m); // place it in the table (and record the rank) if it beats an entry
  renderScoreReadouts(m); // repaint the readouts from the updated table
}
