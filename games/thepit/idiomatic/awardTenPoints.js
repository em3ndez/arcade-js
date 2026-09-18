// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardTenPoints — add 10 to the active player's score (with its sound), repaint digits.
 *
 * One of a small family of thin score-award entries differing only in how much they add
 * and which sound they play (+1, +10 here, +20). This entry plays the score sound and
 * hands a fixed increment to the shared score adder, which bumps the two-byte packed-
 * decimal score of the active player and repaints the on-screen digits. The add lands
 * only while a player is active; the adder skips it otherwise and returns to our caller.
 */
import { requestSound16 } from "./requestSound16.js";
import { addScore } from "./addScore.js";

export function awardTenPoints(m) {
  // Play this entry's score sound.
  requestSound16(m);

  // Hand the +10 increment (packed decimal) to the shared score adder, which returns to us.
  return addScore(m, 0x0010);
}
