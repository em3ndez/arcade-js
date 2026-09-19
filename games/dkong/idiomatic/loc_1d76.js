// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d76 — the "sub-step timer still running" branch of the walk/climb animation stepper.
 * If the climb flag is 0, decrement the timer via the shared tail. If non-zero, mirror it into
 * the neighbouring byte, then hold the timer while (MARIO_CLIMB_LIMIT_B − 0x13) is still >= Mario's
 * Y; otherwise fall into the shared tail and decrement.
 *
 * LIVE-OUT: memory-only — the mirrored flag byte on the non-zero arm, and the decremented
 * MARIO_MOVE_STEP_TIMER on the decrement arms. The residual accumulator and flags are dead;
 * the caller cascade overwrites them before any read.
 */

import {
  MARIO_CLIMB_LIMIT_B,
  MARIO_CLIMB_TOGGLE,
  MARIO_Y,
  loc_621a,
} from "./names.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js";

export function loc_1d76(m) {
  const { mem8 } = m;

  const flag = mem8[loc_621a];
  if (flag === 0) {
    tickMoveStepTimer(m);
    return;
  }

  mem8[MARIO_CLIMB_TOGGLE] = flag; // dead store, reproduced so memory stays identical

  // 8-bit subtraction, so a limit under 0x13 wraps.
  const threshold = (mem8[MARIO_CLIMB_LIMIT_B] - 0x13) & 0xff;
  if (threshold >= mem8[MARIO_Y]) return;

  tickMoveStepTimer(m);
}
