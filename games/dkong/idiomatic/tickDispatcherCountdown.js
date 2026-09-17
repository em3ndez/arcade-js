// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickDispatcherCountdown — tick the effect machine's state-2 hold timer, and reset the machine
 * on expiry.
 *
 * LIVE-OUT: memory-only — EFFECT_TIMER always decremented; on expiry POPUP_SPRITE := 0 and
 * EFFECT_STATE := 0.
 */

import { EFFECT_STATE, EFFECT_TIMER, POPUP_SPRITE } from "./names.js";

export function tickDispatcherCountdown(m) {
  const { mem8 } = m;

  const remaining = (mem8[EFFECT_TIMER] - 1) & 0xff;
  mem8[EFFECT_TIMER] = remaining;
  if (remaining !== 0) return;

  mem8[POPUP_SPRITE] = 0;
  mem8[EFFECT_STATE] = 0;
}
