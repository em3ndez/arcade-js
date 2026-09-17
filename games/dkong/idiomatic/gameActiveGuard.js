// SPDX-License-Identifier: GPL-3.0-only
/**
 * gameActiveGuard — caller-skip guard used as `if (!gameActiveGuard(m)) return;`. Proceeds (true)
 * only while a credited game is in play, i.e. when bit 0 of ATTRACT is CLEAR. Beware the polarity:
 * the Mario-alive guard proceeds when its bit is SET; this one proceeds when the bit is CLEAR.
 *
 * LIVE-OUT: the proceed/skip boolean. No memory is written.
 */

import { ATTRACT } from "./names.js";

export function gameActiveGuard(m) {
  return (m.mem8[ATTRACT] & 0x01) === 0;
}
