// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickDispatcherCountdown — tick the effect machine's state-2 hold timer, and reset the
 * machine on expiry.
 *
 * The effect-sprite state machine is a four-way router on EFFECT_STATE: 0 = idle,
 * 1 = arm-timer, 2 = this countdown, 3 = reset. This is the state-2 arm. The arm-timer state
 * loads EFFECT_TIMER with 64 and advances the router 1 -> 2; state 2 then runs here once per
 * frame:
 *
 *   - decrement EFFECT_TIMER in place, and
 *   - while it is still non-zero, do nothing else (stay in state 2), or
 *   - on the frame it reaches 0, end the hold: clear POPUP_SPRITE and reset EFFECT_STATE to
 *     0, dropping the router back to its idle arm.
 *
 * So a full hold is exactly 64 dispatches — 63 still-counting frames, then one expiry.
 *
 * A LEAF: reads and writes only these three RAM bytes, calls nothing. Both exits are plain
 * returns — there is no caller-skip idiom here — so this routine returns void.
 *
 * LIVE-OUT: memory-only — EFFECT_TIMER always decremented; on expiry POPUP_SPRITE := 0 and
 * EFFECT_STATE := 0.
 */

import { EFFECT_STATE, EFFECT_TIMER, POPUP_SPRITE } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function tickDispatcherCountdown(m) {
  const { mem } = m;

  // Decrement the state-2 countdown in place.
  const remaining = (mem.read8(EFFECT_TIMER) - 1) & 0xff;
  mem.write8(EFFECT_TIMER, remaining);

  // Still counting: stay in state 2, nothing else to do.
  if (remaining !== 0) return;

  // Timer expired: end the hold — clear POPUP_SPRITE and reset EFFECT_STATE to its idle
  // arm (state 0).
  mem.write8(POPUP_SPRITE, 0);
  mem.write8(EFFECT_STATE, 0);
}
