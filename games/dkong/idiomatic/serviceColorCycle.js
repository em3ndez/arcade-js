// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceColorCycle — the once-per-frame outer gate on the colour cycle. If a sweep is
 * running (COLOUR_CYCLE_ACTIVE set) advance it and paint; else if the frame counter is not at
 * its wrap (FRAME non-zero) just repaint the column; else (wrap with no sweep) set
 * COLOUR_CYCLE_ACTIVE and advance a fresh sweep. So a sweep starts once every 256 frames.
 *
 * LIVE-OUT: memory-only.
 */

import { COLOUR_CYCLE_ACTIVE, FRAME } from "./names.js";
import { advanceColorCycleSweep } from "./advanceColorCycleSweep.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

export function serviceColorCycle(m) {
  const { mem8 } = m;

  if (mem8[COLOUR_CYCLE_ACTIVE] !== 0) {
    advanceColorCycleSweep(m);
    return;
  }

  if (mem8[FRAME] !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  mem8[COLOUR_CYCLE_ACTIVE] = 1;
  advanceColorCycleSweep(m);
}
