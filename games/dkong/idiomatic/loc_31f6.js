// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_31f6 — return the low two bits of RANDOM, or FRAME when those bits are exactly 1.
 *
 * LIVE-OUT: the returned byte. No memory is written.
 */

import { RANDOM, FRAME } from "./names.js";

export function loc_31f6(m) {
  const { mem8 } = m;
  const lowBits = mem8[RANDOM] & 0x03;
  if (lowBits !== 1) return lowBits;
  return mem8[FRAME];
}
