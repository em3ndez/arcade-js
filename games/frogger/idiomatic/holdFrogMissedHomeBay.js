// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdFrogMissedHomeBay — the home-row reject handler: when the frog is over no bay and has fully
 * reached the home row (FROG_Y below the threshold) the hit/hold flag is raised, losing the frog;
 * either way it tail-dispatches the frog input scan. LIVE-OUT: memory-only.
 */
import { FROG_Y, HOLD_FLAG } from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";

const HOME_ROW_Y = 0x2a;

export function holdFrogMissedHomeBay(m) {
  const { mem8 } = m;
  if (mem8[FROG_Y] < HOME_ROW_Y) mem8[HOLD_FLAG] = 1;
  return scanFrogInputAndDispatchHop(m);
}
