// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardTenPoints — add 10 to the active player's score (with its sound), then repaint the digits.  ROM 0x467b.
 *
 * One of a small family of thin score-award entries that differ only in how much they
 * add and which sound they play: +1, +10 (this one), and +20. Each plays its own score
 * sound and then hands a fixed increment to the shared score adder, which bumps the
 * two-byte packed-decimal score of the active player and repaints the on-screen digits.
 *
 * This entry plays the score sound (command 16) and adds 10. The add only lands while a
 * player is active; the shared adder skips it otherwise, so an inactive slot (as in the
 * attract demo) leaves the score untouched. Nothing comes back here afterwards — the
 * adder returns straight to our own caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-467b.test.js.
 * GATE:     crafted-entry — attract never awards +10, so the gate runs this entry from
 *           real captured attract states over both the active-player add path (the score
 *           gains 10) and the inactive skip path (the score is untouched), identical to
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

export function awardTenPoints(m) {
  // Play this entry's score sound.
  requestSound16(m);

  // Hand the +10 increment to the shared score adder and let it run: it adds 10 to the
  // active player's score and repaints the digits, skipping the add when no player is
  // active, then returns straight to our own caller. The increment is packed decimal —
  // the low byte 0x10 is a decimal-coded "10" the adder folds into the score's tens place.
  return addScore(m, 0x0010);
}
