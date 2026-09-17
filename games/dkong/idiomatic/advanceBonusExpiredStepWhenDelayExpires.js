// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBonusExpiredStepWhenDelayExpires — the DELAY step of the bonus-expired sequence: tick
 * the delay byte down each frame and, only on the frame it reaches zero, advance the sequence
 * to its next step. The delay starts at zero, so the first decrement wraps to 255 — a full
 * 256-frame pause.
 *
 * LIVE-OUT: memory-only — the decremented delay, and the sequence's step on the frame it expires.
 */

import { BONUS_EXPIRED_DELAY, BONUS_EXPIRED_STEP } from "./names.js";

export function advanceBonusExpiredStepWhenDelayExpires(m) {
  const { mem8 } = m;

  const remaining = (mem8[BONUS_EXPIRED_DELAY] - 1) & 0xff;
  mem8[BONUS_EXPIRED_DELAY] = remaining;

  if (remaining !== 0) return;

  mem8[BONUS_EXPIRED_STEP] = 0x03;
}
