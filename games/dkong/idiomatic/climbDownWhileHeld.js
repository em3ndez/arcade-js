// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbDownWhileHeld — the Down half of the ladder-climb input dispatch: drive Mario's downward
 * climb while Down is held, otherwise hand the frame to the up-climb path.
 *
 * Reads the cooked control word and tests its DOWN bit (bit 3) first:
 *   - Down held: hand off to the climb-down driver, which paces and advances Mario's descent this
 *     frame, and stop. Note the descent is NOT gated on MARIO_ON_LADDER here — holding Down drives
 *     the climb-down driver directly.
 *   - Down clear: the up-climb path applies only while Mario is on a ladder, so with
 *     MARIO_ON_LADDER clear the routine does nothing and returns. Otherwise it falls through to the
 *     up-climb guard, which tests the UP bit and climbs if it is held.
 *
 * WHAT THE NAME CLAIMS. Bit 3 of the control word is the recorded Down direction and the callee on
 * that arm is the climb-down driver, so the name is this routine's own action; the up-delegation is
 * the else-path and is deliberately left out of it. NOT CLAIMED: why the Down arm skips the
 * on-ladder guard the Up arm insists on. The asymmetry is plainly in the body; its reason is not.
 *
 * Reads: P1_INPUT and MARIO_ON_LADDER. Writes: nothing of its own — every write is made by
 * whichever driver it hands the frame to.
 * LIVE-OUT: memory-only. Its tail-calling callers consume no register it leaves.
 */

import { P1_INPUT, MARIO_ON_LADDER } from "./names.js";
import { climbMarioDown } from "./climbMarioDown.js";
import { climbUpWhileHeld } from "./climbUpWhileHeld.js";

// Bit 3 of the cooked control word = the DOWN direction (bit0 Right, bit1 Left, bit2 Up,
// bit3 Down); held while the player pushes down on the ladder.
const HOLDING_DOWN = 0x08;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function climbDownWhileHeld(m) {
  const { mem } = m;

  // Holding Down this frame: drive Mario's downward ladder climb and stop.
  if (mem.read8(P1_INPUT) & HOLDING_DOWN) {
    climbMarioDown(m);
    return;
  }

  // Down not held: the up-climb path applies only while Mario is on a ladder.
  if (mem.read8(MARIO_ON_LADDER) === 0) return;
  climbUpWhileHeld(m);
}
