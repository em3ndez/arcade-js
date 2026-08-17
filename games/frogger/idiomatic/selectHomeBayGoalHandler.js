// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHomeBayGoalHandler — the home-bay column dispatcher: read the frog X and route to the goal
 * handler for the bay whose column band contains it, or to the reject handler when the frog sits
 * between bays (every gap, and X below the first band, is a miss). LIVE-OUT: memory-only.
 */
import { FROG_X } from "./names.js";
import {
  awardHomeBay1Goal, awardHomeBay2Goal, awardHomeBay3Goal, awardHomeBay4Goal, awardHomeBay5Goal,
} from "./awardHomeBayGoal.js";
import { holdFrogMissedHomeBay } from "./holdFrogMissedHomeBay.js";

// Five inclusive frog-X bands and their goal handlers; anything outside every band is the reject.
const BAYS = [
  { lo: 0x15, hi: 0x1c, handler: awardHomeBay1Goal },
  { lo: 0x45, hi: 0x4c, handler: awardHomeBay2Goal },
  { lo: 0x75, hi: 0x7c, handler: awardHomeBay3Goal },
  { lo: 0xa5, hi: 0xac, handler: awardHomeBay4Goal },
  { lo: 0xd5, hi: 0xdc, handler: awardHomeBay5Goal },
];

export function selectHomeBayGoalHandler(m) {
  const x = m.mem8[FROG_X];
  for (const b of BAYS) {
    if (x >= b.lo && x <= b.hi) return b.handler(m);
  }
  return holdFrogMissedHomeBay(m);
}
