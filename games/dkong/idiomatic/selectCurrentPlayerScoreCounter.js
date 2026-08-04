// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectCurrentPlayerScoreCounter — select the score-counter address for the player
 * currently up.  ROM 0x055F.
 *
 * Reads which player is up and hands back the base address of that player's
 * three-byte score counter: player 1's counter when the current-player flag is
 * zero, player 2's otherwise. The score-award and high-score-compare code call
 * this to learn which counter to touch, then work from the returned address.
 *
 * A LEAF: reads CURRENT_PLAYER only, writes no memory, and returns the chosen
 * address — nothing else it computes along the way survives the call.
 *
 * GROUNDED (DK understanding pass 5, independent confirmer): names.js's CURRENT_PLAYER
 * (0x600D) note independently cites this ROM routine (sub_055f) as the one that selects
 * the score slot from that flag — `ret z` → P1_SCORE (0x60B2), else P2_SCORE (0x60B5) —
 * and all three cells are named. The gate is exhaustive over the sole input byte.
 *
 * Memory-equivalent to the frozen oracle — equivalence-055f.test.js.
 * GATE:     exhaustive over the sole input byte — CURRENT_PLAYER across all 256
 *           values on a real base machine — which is a complete proof for a
 *           one-byte input the routine reads nothing else beside. Not dispatched
 *           during attract (0 in 2000 frames), so there is no captured arm to add.
 * LIVE-OUT: the selected score-slot address (the oracle returns it in a register;
 *           here it is the plain return value). No memory is written, and the
 *           residual flags the oracle leaves behind are dead — no caller reads them.
 * NAMES:    CURRENT_PLAYER (0x600D), P1_SCORE (0x60B2), P2_SCORE (0x60B5) — all from names.js.
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
