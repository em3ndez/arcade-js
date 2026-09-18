// SPDX-License-Identifier: GPL-3.0-only
import { VARIANT } from "./names.js";
/**
 * submitPlayerHighScore — offer the finishing player's final score to the high-score table
 * and repaint the score readouts.  Run once per player at end-of-round teardown; the caller
 * picks the finishing player, then reads back the landed-rank result. In order: start the
 * landed rank at 0 (the insert leaves it untouched on a miss), make that player's saved score
 * the live shared score, offer it to the three-entry table (a beat slides the loser down,
 * recording rank 1/2/3), then repaint the three readouts from the updated table.
 */

import { loadPlayerState } from "./loadPlayerState.js";
import { insertHighScore } from "./insertHighScore.js";
import { renderScoreReadouts } from "./renderScoreReadouts.js";

const LANDED_RANK = VARIANT; // rank (1/2/3) the score placed at; 0 = it did not make the table

export function submitPlayerHighScore(m) {
  const { mem8 } = m;

  // "Did not place" until the insert proves otherwise.
  mem8[LANDED_RANK] = 0;

  loadPlayerState(m); // bring the finishing player's saved score into the live shared slot
  insertHighScore(m); // place it in the table (and record the rank) if it beats an entry
  renderScoreReadouts(m); // repaint the readouts from the updated table
}
