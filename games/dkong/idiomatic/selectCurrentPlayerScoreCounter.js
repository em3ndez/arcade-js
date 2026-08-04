// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectCurrentPlayerScoreCounter — select the score-counter address for the player
 * currently up.
 *
 * Reads which player is up and hands back the base address of that player's
 * three-byte score counter: player 1's counter when the current-player flag is
 * zero, player 2's otherwise. The score-award and high-score-compare code call
 * this to learn which counter to touch, then work from the returned address.
 *
 * A LEAF: reads CURRENT_PLAYER only, writes no memory, and returns the chosen
 * address — nothing else it computes along the way survives the call.
 *
 * LIVE-OUT: the selected score-slot address. No memory is written, and the flags
 * left behind reach no caller.
 */

import { CURRENT_PLAYER, P1_SCORE, P2_SCORE } from "./names.js";

/**
 * @param {object} m  the machine (reads m.mem only).
 * @returns {number}  base address of the current player's score counter.
 */
export function selectCurrentPlayerScoreCounter(m) {
  const { mem } = m;
  return mem.read8(CURRENT_PLAYER) === 0 ? P1_SCORE : P2_SCORE;
}
