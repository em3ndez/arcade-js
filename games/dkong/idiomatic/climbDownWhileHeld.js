// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbDownWhileHeld — the Down half of the ladder-climb input dispatch: drive Mario's
 * downward climb when Down is held, otherwise hand the frame to the up-climb path.  ROM 0x1B38.
 *
 * Reads the cooked control word and tests its DOWN bit (bit 3) first:
 *   - Down held: hand off to the climb-DOWN driver (climbMarioDown), which paces and
 *     advances Mario's descent this frame, and stop. Note the descent is NOT gated on
 *     the on-ladder flag here — holding Down drives the climb-down driver directly.
 *   - Down clear: the up-climb path only applies while Mario is on a ladder, so if the
 *     on-ladder flag is clear it does nothing and returns; otherwise it falls through
 *     to climbUpWhileHeld, which tests the UP bit and climbs up if it is held.
 *
 * This is the sibling of climbUpWhileHeld (ROM 0x1B45): this routine owns the DOWN
 * direction and delegates the UP direction to it. It is reached by a tail-call from the
 * movement machine (dispatchMarioMovement, only while the on-ladder flag is set) and from the climb
 * setup routine loc_1afe; it writes no memory of its own.
 *
 * Promoted from loc_1b38 (DK understanding pass 10, independent proposer≠confirmer, MODERATE):
 * bit 3 is the confirmed Down direction (a named input bit) and climbMarioDown is the confirmed
 * climb-down driver; the name captures this routine's OWN action (the exact framing of its
 * accepted sibling climbUpWhileHeld, 0x1B45). The up-delegation is the documented else-path.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b38.test.js.
 * GATE:     real captured 0x1B38 dispatches from an attract run (natural dispatches take
 *           the Up fall-through arm — attract only climbs up, and dispatchMarioMovement reaches here
 *           only on-ladder) + an exhaustive 256-value control-word sweep that pins the
 *           bit-3 Down test + an on-ladder sweep that pins the ladder guard on the Up arm
 *           + crafted Down-arm entries (attract never climbs down). climbMarioDown and
 *           climbUpWhileHeld are already idiomatic and direct-called, so this also
 *           composes their equivalence. Teeth: inverted-down-guard, wrong-bit (Up vs
 *           Down), and dropped-ladder-guard.
 * LIVE-OUT: memory-only — this routine writes nothing itself; the driver it hands off to
 *           writes. Its tail-calling callers consume no register it leaves, and the chain
 *           nets exactly one caller-return.
 * NAMES:    P1_INPUT (0x6010), MARIO_ON_LADDER (0x6215) from ram.js. Delegates to the
 *           already-idiomatic climbMarioDown (ROM 0x1CF2) and climbUpWhileHeld (ROM
 *           0x1B45); the cells those chains touch are named in their own headers.
 */

import { P1_INPUT, MARIO_ON_LADDER } from "./ram.js";
import { climbMarioDown } from "./climbMarioDown.js";     // ROM 0x1CF2
import { climbUpWhileHeld } from "./climbUpWhileHeld.js"; // ROM 0x1B45

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
    climbMarioDown(m); // ROM 0x1CF2
    return;
  }

  // Down not held: the up-climb path applies only while Mario is on a ladder.
  if (mem.read8(MARIO_ON_LADDER) === 0) return;
  climbUpWhileHeld(m); // ROM 0x1B45
}
