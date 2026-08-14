// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0292 — count the in-play countdown word down by one; clear the expiry flag when it reaches zero.
 * LIVE-OUT: memory-only.
 */
import { loc_829d, loc_83ae } from "./names.js";

export function loc_0292(m) {
  const { mem8, mem16 } = m;
  const count = mem16[loc_829d];
  if (count === 0) return; // already at zero: nothing to count down
  const next = (count - 1) & 0xffff;
  mem16[loc_829d] = next;
  if (next === 0) mem8[loc_83ae] = 0;
}
