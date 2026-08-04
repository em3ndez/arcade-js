// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbUpWhileHeld — when the player is holding UP, drive Mario's upward climb this frame.  ROM 0x1B45.
 *
 * Reads the cooked control word and tests its UP bit (bit 2). If Up is held this frame it
 * hands off to the climb-UP driver (climbMarioUp), which paces and advances Mario's ladder
 * climb; otherwise it does nothing and returns. A pure input guard sitting in front of the
 * climb driver — it writes no memory of its own, only reads the control word.
 *
 * This is the "Up" half of the ladder-climb input dispatch: its sibling caller loc_1b38
 * tests the DOWN bit (bit 3) and hands off to the climb-DOWN driver (climbMarioDown) before
 * falling through here to test Up.
 *
 * Name: bit 2 of the control word is the confirmed UP direction (a named input bit) and
 * climbMarioUp is the confirmed climb-up driver (promoted, ROM 0x1D03), so the meaning is
 * fully pinned with zero interpretive leap — promoted from loc_1b45 (pass-9 proposer/confirmer,
 * HIGH confidence).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b45.test.js.
 * GATE:     real captured 0x1B45 dispatches from an attract run (both arms fire — attract
 *           climbs ladders, so Up is held on some frames and clear on others) + an
 *           exhaustive 256-value sweep of the control word that pins the exact bit-2 test.
 *           climbMarioUp is already idiomatic and direct-called, so this also composes its
 *           equivalence. Teeth: an inverted guard and a wrong-bit guard.
 * LIVE-OUT: memory-only — this routine writes nothing itself; on the Up arm the climb driver
 *           writes. The tail-calling caller (loc_1b38) consumes no register it leaves, and
 *           the chain nets exactly one caller-return.
 * NAMES:    P1_INPUT (0x6010) from names.js. Delegates to the already-idiomatic climbMarioUp
 *           (ROM 0x1D03); the cells that chain touches are documented in its own header.
 */

import { P1_INPUT } from "./names.js";
import { climbMarioUp } from "./climbMarioUp.js"; // ROM 0x1D03

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
    climbMarioUp(m); // ROM 0x1D03
  }
}
