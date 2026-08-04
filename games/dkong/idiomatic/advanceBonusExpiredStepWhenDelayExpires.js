// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBonusExpiredStepWhenDelayExpires — the pause in the bonus-expired sequence: hold the
 * sequence where it is until a countdown runs out, then let it move on.
 *
 * The bonus-expired sequence is a small state machine that runs when a board's bonus reaches zero,
 * and this is the step that waits. Every frame it takes one off the delay byte; while that byte is
 * still non-zero the sequence stays parked here, and only on the frame it reaches zero does the
 * sequence advance to its next step.
 *
 * The delay starts at zero, so the first decrement wraps it to 255: the pause is a full 256-frame
 * roll, not a configured length.
 *
 * A LEAF: it reads and writes the delay byte, writes the next step number on expiry, and calls
 * nothing.
 *
 * LIVE-OUT: memory-only — the decremented delay, and the sequence's step on the frame it expires.
 */

import { BONUS_EXPIRED_DELAY, BONUS_EXPIRED_STEP } from "./names.js";

/**
 * @param {object} m  the machine; memory only.
 */
export function advanceBonusExpiredStepWhenDelayExpires(m) {
  const { mem } = m;

  // Tick the delay down one frame.
  const remaining = (mem.read8(BONUS_EXPIRED_DELAY) - 1) & 0xff;
  mem.write8(BONUS_EXPIRED_DELAY, remaining);

  // While it is still counting, stay parked here.
  if (remaining !== 0) return;

  // The delay elapsed — let the sequence move on.
  mem.write8(BONUS_EXPIRED_STEP, 0x03);
}
