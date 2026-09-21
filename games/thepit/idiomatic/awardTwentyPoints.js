// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardTwentyPoints — add 20 to the active player's score (with its sound), then repaint
 * the digits. The largest of a small family of thin score-award entries differing only in
 * how much they add and which sound they play (+1, +10, +20). This one plays the score
 * sound (command 16, shared with the +10 award) and hands +20 to the shared adder, which
 * bumps the active player's two-byte packed-decimal score and repaints the digits — an
 * inactive slot (as in the attract demo) leaves the score untouched.
 */
import { requestSound16 } from "./requestSound16.js";
import { addScore } from "./addScore.js";

export function awardTwentyPoints(m) {
  // Play this entry's score sound.
  requestSound16(m);

  // Hand +20 to the shared adder: it scores the active player and repaints the digits.
  // The increment is packed decimal — its low byte codes the decimal "20".
  return addScore(m, 0x20);
}
