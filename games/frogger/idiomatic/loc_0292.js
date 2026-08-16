// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0292 — count the in-play countdown word down by one; clear the expiry flag when it reaches zero.
 * LIVE-OUT: memory-only.
 */
import { INPLAY_COUNTDOWN_WORD, COUNTDOWN_EXPIRY_FLAG } from "./names.js";

export function loc_0292(m) {
  const { mem8, mem16 } = m;
  const count = mem16[INPLAY_COUNTDOWN_WORD];
  if (count === 0) return; // already at zero: nothing to count down
  const next = (count - 1) & 0xffff;
  mem16[INPLAY_COUNTDOWN_WORD] = next;
  if (next === 0) mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
}
