// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardOnePoint — add one point to the running score.  ROM 0x4673.
 *
 * The smallest of three sibling score awards (+1, +10, +20) that differ only in the
 * amount they add and the sound they play. This one plays the one-point pickup sound,
 * then hands an increment of one to the shared scorer, which folds it (in packed BCD,
 * with carry) into the two-byte score counter and repaints the four on-screen score
 * digits for the active player. The +1 award has its own distinct sound; the two larger
 * awards share a different one. Takes no inputs — its whole job is those side effects.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4673.test.js.
 * GATE:     crafted-entry — attract never awards a point, so the gate captures a real
 *           sibling sound-request state and runs the award from it, comparing the
 *           observable RAM (score counter, sound ring, on-screen digits) outside the
 *           dead stack scratch the sound call leaves just below the entry stack pointer;
 *           it sweeps the active/idle game-mode gate across the scorer's add-and-skip
 *           branches and confirms the return pc and stack pointer match. Teeth catch a
 *           wrong increment and a wrong sound.
 * LIVE-OUT: memory-only — the updated score bytes, the queued sound, and the score
 *           digits the shared scorer stamps into video RAM. No value register is read
 *           downstream; the shared return path runs on both sides and matches the oracle.
 * NAMES:    none directly — the sound routes through requestSound13; the score counter
 *           and the digit render belong to the shared scorer, addScore.
 */
import { requestSound13 } from "./requestSound13.js";
import { addScore } from "./addScore.js";

export function awardOnePoint(m) {
  // Play the one-point pickup sound.
  requestSound13(m);

  // Add one point: the shared scorer folds this increment into the score counter and
  // repaints the on-screen digits.
  return addScore(m, 1);
}
