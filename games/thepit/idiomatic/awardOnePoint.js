// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardOnePoint — add one point to the running score.
 *
 * The smallest of three sibling score awards (+1, +10, +20) that differ only in the amount added and
 * the sound played. This plays the one-point pickup sound, then hands an increment of one to the
 * shared scorer addScore, which folds it (packed BCD, with carry) into the two-byte score counter and
 * repaints the four on-screen digits for the active player. Takes no inputs — its whole job is those
 * side effects.
 */
import { requestSound13 } from "./requestSound13.js";
import { addScore } from "./addScore.js";

export function awardOnePoint(m) {
  // Play the one-point pickup sound.
  requestSound13(m);
  return addScore(m, 1);
}
