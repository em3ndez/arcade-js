// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbDownWhileHeld — the Down half of the ladder-climb input dispatch: with Down held (P1_INPUT
 * bit 3) drive the climb-down driver directly; otherwise fall through to the up-climb path, which
 * applies only while MARIO_ON_LADDER is set. The Down arm is deliberately not gated on the ladder.
 *
 * LIVE-OUT: memory-only, all written by whichever driver takes the frame.
 */

import { P1_INPUT, MARIO_ON_LADDER } from "./names.js";
import { climbMarioDown } from "./climbMarioDown.js";
import { climbUpWhileHeld } from "./climbUpWhileHeld.js";

const HOLDING_DOWN = 0x08;

export function climbDownWhileHeld(m) {
  const { mem8 } = m;

  if (mem8[P1_INPUT] & HOLDING_DOWN) {
    climbMarioDown(m);
    return;
  }

  if (mem8[MARIO_ON_LADDER] === 0) return;
  climbUpWhileHeld(m);
}
