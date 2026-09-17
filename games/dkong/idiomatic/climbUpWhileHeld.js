// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbUpWhileHeld — the "Up" half of the ladder-climb input dispatch: if the cooked control word
 * P1_INPUT has its UP bit (bit 2) held, hand off to the climb-up driver; otherwise do nothing.
 *
 * LIVE-OUT: memory-only — on the Up arm the climb driver writes; this routine writes nothing.
 */

import { P1_INPUT } from "./names.js";
import { climbMarioUp } from "./climbMarioUp.js";

const HOLDING_UP = 0x04; // bit 2 = Up (bit0 Right, bit1 Left, bit2 Up, bit3 Down)

export function climbUpWhileHeld(m) {
  const { mem8 } = m;

  if (mem8[P1_INPUT] & HOLDING_UP) {
    climbMarioUp(m);
  }
}
