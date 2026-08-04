// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbUpWhileHeld — when the player is holding UP, drive Mario's upward climb this frame.
 *
 * Reads the cooked control word P1_INPUT and tests its UP bit (bit 2). If Up is held this
 * frame it hands off to the climb-up driver, which paces and advances Mario's ladder climb;
 * otherwise it does nothing and returns. A pure input guard sitting in front of that driver —
 * it writes no memory of its own, only reads the control word.
 *
 * This is the "Up" half of the ladder-climb input dispatch: the Down half tests bit 3 and
 * hands off to the climb-down driver before falling through to here.
 *
 * The name rests on two confirmed pieces: bit 2 of the control word is the UP direction, and
 * the callee is the confirmed climb-up driver — so there is no interpretive leap in it.
 *
 * LIVE-OUT: memory-only — this routine writes nothing itself; on the Up arm the climb driver
 * writes.
 */

import { P1_INPUT } from "./names.js";
import { climbMarioUp } from "./climbMarioUp.js";

// Bit 2 of the cooked control word = the UP direction (bit0 Right, bit1 Left, bit2 Up,
// bit3 Down); held while the player pushes up on the ladder.
const HOLDING_UP = 0x04;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function climbUpWhileHeld(m) {
  const { mem } = m;

  // Only climb while the player is holding Up this frame; otherwise leave Mario be.
  if (mem.read8(P1_INPUT) & HOLDING_UP) {
    climbMarioUp(m);
  }
}
