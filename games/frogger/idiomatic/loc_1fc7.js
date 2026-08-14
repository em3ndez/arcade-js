// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fc7 — tick a gated countdown, clearing its enable flag when it expires.
 * While the enable flag is clear, does nothing. Otherwise it decrements the counter and,
 * when the counter reaches zero, clears the enable flag.
 * LIVE-OUT: memory-only.
 */
import { loc_826a, loc_826c } from "./names.js";

export function loc_1fc7(m) {
  const { mem8 } = m;
  if (mem8[loc_826c] === 0) return;
  const next = (mem8[loc_826a] - 1) & 0xff;
  mem8[loc_826a] = next;
  if (next !== 0) return;
  mem8[loc_826c] = 0;
}
