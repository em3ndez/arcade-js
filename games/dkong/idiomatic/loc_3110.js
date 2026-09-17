// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3110 — frame-phase caller-skip gate: proceed on the odd frames, one of every two. The
 * narrowest arm of a difficulty-selected throttle family. `if (!loc_3110(m)) return;`
 *
 * LIVE-OUT: the proceed/skip boolean.
 */

import { FRAME } from "./names.js";

export function loc_3110(m) {
  // Polarity outlier: an EQUALITY on bit 0, where the siblings test a less-than on a wider phase.
  return (m.mem8[FRAME] & 1) === 1;
}
