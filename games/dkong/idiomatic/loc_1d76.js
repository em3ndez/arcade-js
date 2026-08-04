// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d76 — the "sub-step timer still running" branch of the walk/climb animation
 * stepper; conditionally ticks the timer down.
 *
 * The player walk/climb animation stepper jumps here whenever the 4-frame sub-step timer
 * MARIO_MOVE_STEP_TIMER is still non-zero — the mover is mid-hold between animation
 * sub-steps. This branch decides whether to knock that timer down by one this frame, gated on
 * a flag byte and a climb-limit compare:
 *
 *   - Read the climb flag. If it is 0, decrement the timer via the shared tail and return.
 *   - If it is non-zero: mirror it into the neighbouring byte, then compare
 *     (MARIO_CLIMB_LIMIT_B − 0x13) against Mario's Y. If that value is still ≥ Y, HOLD the
 *     timer and return without decrementing; otherwise fall into the shared tail and
 *     decrement.
 *
 * WHY THE TWO FLAG BYTES STAY ANONYMOUS. The one it reads looks like a broken-ladder flag,
 * but it is ALSO written by an unrelated object arm, so no single board's reading settles it.
 * The one it writes is a climb toggle with two writers and no absolute reader at all, so this
 * store is dead as far as any reader is concerned and is reproduced only to keep memory
 * identical. Because the read flag's true role is not confidently understood, the routine
 * keeps a neutral name rather than risk a misleading English one.
 *
 * It reads no live-in register: its first act overwrites A, and HL is set but never read.
 *
 * LIVE-OUT: memory-only — the mirrored flag byte on the non-zero arm, and the decremented
 * MARIO_MOVE_STEP_TIMER on the decrement arms. The residual accumulator and flags are dead;
 * the caller cascade overwrites them before any read.
 */

import { MARIO_Y, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js";

// The gate flag and its mirror. Neither carries a shared name — the first is a byte an
// unrelated object arm also writes, the second is write-only with no absolute reader — so
// they stay file-local addresses rather than implying a meaning the evidence does not carry.
const CLIMB_FLAG = 0x621a;
const CLIMB_FLAG_MIRROR = 0x6219;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function loc_1d76(m) {
  const { mem } = m;

  // Flag zero: just tick the timer down.
  const flag = mem.read8(CLIMB_FLAG);
  if (flag === 0) {
    tickMoveStepTimer(m); // the shared tail: decrement the sub-step timer
    return;
  }

  // Mirror the flag — a dead store, reproduced so memory stays identical.
  mem.write8(CLIMB_FLAG_MIRROR, flag);

  // Hold the timer while (limit − 0x13) is still at or past Mario's Y. The subtraction is
  // 8-bit, so a limit under 0x13 wraps.
  const threshold = (mem.read8(MARIO_CLIMB_LIMIT_B) - 0x13) & 0xff;
  if (threshold >= mem.read8(MARIO_Y)) return;

  // Fall into the shared tail and decrement.
  tickMoveStepTimer(m);
}
