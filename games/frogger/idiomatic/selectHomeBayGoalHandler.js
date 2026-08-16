// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHomeBayGoalHandler — the home-bay column dispatcher: read the frog X and route to the goal
 * handler for the bay whose column band contains it, or to the reject handler when the frog sits
 * between bays (every gap, and X below the first band, is a miss). LIVE-OUT: memory-only.
 */
import { FROG_X } from "./names.js";

// Five inclusive frog-X bands and their goal handlers; anything outside every band is the reject.
const REJECT = 0x1d77;
const BAYS = [
  { lo: 0x15, hi: 0x1c, handler: 0x1d87 },
  { lo: 0x45, hi: 0x4c, handler: 0x1dd8 },
  { lo: 0x75, hi: 0x7c, handler: 0x1e29 },
  { lo: 0xa5, hi: 0xac, handler: 0x1e7a },
  { lo: 0xd5, hi: 0xdc, handler: 0x1ecb },
];

export function selectHomeBayGoalHandler(m) {
  const x = m.mem8[FROG_X];
  for (const b of BAYS) {
    if (x >= b.lo && x <= b.hi) return m.call(b.handler);
  }
  return m.call(REJECT);
}
