// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickGatedCountdown — tick a gated countdown, clearing its enable flag when it expires.
 * While the enable flag is clear, does nothing. Otherwise it decrements the counter and,
 * when the counter reaches zero, clears the enable flag.
 * LIVE-OUT: memory-only.
 */
import { GATED_COUNTDOWN_COUNTER, GATED_COUNTDOWN_ENABLE_FLAG } from "./names.js";

export function tickGatedCountdown(m) {
  const { mem8 } = m;
  if (mem8[GATED_COUNTDOWN_ENABLE_FLAG] === 0) return;
  const next = (mem8[GATED_COUNTDOWN_COUNTER] - 1) & 0xff;
  mem8[GATED_COUNTDOWN_COUNTER] = next;
  if (next !== 0) return;
  mem8[GATED_COUNTDOWN_ENABLE_FLAG] = 0;
}
