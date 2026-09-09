// SPDX-License-Identifier: GPL-3.0-only
import { loc_a1, loc_b5, loc_41, loc_f2, loc_100a } from "./names.js";

/**
 * tickColumnCountdown — tick a per-tick column countdown. Most ticks just
 * decrement it; when it wraps through zero, reload it with a random interval
 * (0x0f or 0x2f) and re-arm two companion cells (one to 0x14, one to 0x14 ^ mask).
 */
export function tickColumnCountdown(m) {
  const { mem8 } = m;

  // Decrement the countdown; while it has not reached zero there is nothing more to do.
  const next = (mem8[loc_a1] - 1) & 0xff;
  mem8[loc_a1] = next;
  if (next !== 0) return;

  // Wrapped: reload a fresh random interval (0x0f or 0x2f) and re-arm the companion cells.
  mem8[loc_a1] = (m.mem8[loc_100a] & 0x2f) | 0x0f;
  mem8[loc_b5] = 0x14;
  mem8[loc_41] = 0x14 ^ mem8[loc_f2];
}
