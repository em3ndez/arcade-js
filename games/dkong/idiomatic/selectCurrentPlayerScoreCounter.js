// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectCurrentPlayerScoreCounter — return the base address of the current player's three-byte
 * score counter: player 1's when CURRENT_PLAYER is zero, player 2's otherwise.
 *
 * LIVE-OUT: the selected score-slot address.
 */

import { CURRENT_PLAYER, P1_SCORE, P2_SCORE } from "./names.js";

export function selectCurrentPlayerScoreCounter(m) {
  const { mem8 } = m;
  return mem8[CURRENT_PLAYER] === 0 ? P1_SCORE : P2_SCORE;
}
