// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2679 — on a timer, reverse the third board object's step direction, then run the shared
 * publish/animate tail.
 *
 * The third of three near-identical object updates in the conveyor board's object cascade. It
 * manages one object's periodic direction reversal and then falls through to the shared tail:
 *
 *   - On frames whose frame-counter low bit is SET it does nothing of its own and drops
 *     straight through to the tail, so its countdown only advances every other frame.
 *   - On the other frames it ticks the object's reversal countdown down by one. While the
 *     countdown has not reached zero it just runs the tail. When it does reach zero it reloads
 *     the countdown to its full period and reverses the object's step-direction latch, so the
 *     object periodically flips which way it travels.
 *
 * The two sibling drivers work the same way, each with its own paired countdown and latch. The
 * shared tail reduces the latch to a unit step, publishes it to the mover's shadow byte, and
 * every 32nd frame advances the mirrored sprite pair.
 *
 * The reversal helper reads the byte it flips from a pointer register, so the latch address is
 * loaded before the call. The tail sets up its own pointers and takes nothing from here.
 *
 * NOT CLAIMED: which on-screen object this steers. The mechanism is a timed step-direction
 * reversal; the identity of the thing being moved is not established.
 *
 * Reads: the frame counter; this object's reversal countdown. Writes: that countdown, and —
 * through the reversal helper on the frame it expires — the object's step-direction latch.
 *
 * LIVE-OUT: memory-only. Every path ends in the shared tail.
 */

import { u8 } from "../../../core/int.js";
import { FRAME, M50_OBJ3_REVERSE_TIMER, M50_OBJ3_STEP_DIR } from "./names.js";
import { loc_268d } from "./loc_268d.js";
import { reverseStepDirection } from "./reverseStepDirection.js";

export function loc_2679(m) {
  const { regs, mem } = m;

  // On frames whose low bit is set, skip the countdown entirely and run the shared tail —
  // so the reversal timer only advances on every other frame.
  if ((mem.read8(FRAME) & 0x01) !== 0) return loc_268d(m);

  // Tick the reversal countdown. Until it reaches zero, just run the tail.
  const remaining = u8(mem.read8(M50_OBJ3_REVERSE_TIMER) - 1);
  mem.write8(M50_OBJ3_REVERSE_TIMER, remaining);
  if (remaining !== 0) return loc_268d(m);

  // Countdown expired: reload it and reverse the object's step direction, then run the tail.
  mem.write8(M50_OBJ3_REVERSE_TIMER, 0xff);
  regs.hl = M50_OBJ3_STEP_DIR; // the reversal helper flips the byte at this pointer
  reverseStepDirection(m);
  return loc_268d(m);
}
