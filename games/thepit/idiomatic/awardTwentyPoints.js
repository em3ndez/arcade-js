// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardTwentyPoints — add 20 to the active player's score (with its sound), then repaint the digits.  ROM 0x4683.
 *
 * The largest of the small family of thin score-award entries that differ only in how
 * much they add and which sound they play: +1, +10, and +20 (this one). Each plays its
 * score sound and then hands a fixed increment to the shared score adder, which bumps the
 * two-byte packed-decimal score of the active player and repaints the on-screen digits.
 *
 * This entry plays the score sound (command 16 — the same sound the +10 award uses) and
 * adds 20. The add only lands while a player is active; the shared adder skips it
 * otherwise, so an inactive slot (as in the attract demo) leaves the score untouched.
 * Nothing comes back here afterwards — the adder returns straight to our own caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4683.test.js.
 * GATE:     crafted-entry — attract never awards +20, so the gate runs this entry from
 *           real captured attract states over both the active-player add path (the score
 *           gains 20) and the inactive skip path (the score is untouched), identical to
 *           the oracle over RAM (outside the dead stack scratch) + pc + SP. Teeth catch a
 *           wrong sound, a wrong increment, and a dropped add.
 * LIVE-OUT: memory-only — the packed-decimal score bytes, the repainted score digits, and
 *           the queued sound command. The registers and flags the oracle path leaves
 *           behind are dead scratch no caller reads.
 * NAMES:    none of its own — delegates to requestSound16 (which owns the sound ring) and
 *           to the shared score adder addScore (which owns the score bytes).
 */
import { requestSound16 } from "./requestSound16.js";
import { addScore } from "./addScore.js";

export function awardTwentyPoints(m) {
  // Play this entry's score sound.
  requestSound16(m);

  // Hand the +20 increment to the shared score adder and let it run: it adds 20 to the
  // active player's score and repaints the digits, skipping the add when no player is
  // active, then returns straight to our own caller. The increment is packed decimal —
  // the low byte 0x20 is a decimal-coded "20" the adder folds into the score's tens place.
  return addScore(m, 0x0020);
}
