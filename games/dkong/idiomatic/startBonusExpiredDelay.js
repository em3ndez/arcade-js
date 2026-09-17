// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBonusExpiredDelay — the INIT (state 1) of the bonus-expired sequence: clear
 * BONUS_EXPIRED_DELAY to 0 and advance BONUS_EXPIRED_STEP to 2 (DELAY). The cleared delay's
 * first decrement in state 2 wraps 0 -> 255, a full 256-frame delay.
 *
 * LIVE-OUT: memory-only — BONUS_EXPIRED_DELAY := 0 and BONUS_EXPIRED_STEP := 2.
 */

import { BONUS_EXPIRED_STEP, BONUS_EXPIRED_DELAY } from "./names.js";

export function startBonusExpiredDelay(m) {
  const { mem8 } = m;

  mem8[BONUS_EXPIRED_DELAY] = 0;
  mem8[BONUS_EXPIRED_STEP] = 2;
}
