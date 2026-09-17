// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3131 — frame-phase caller-skip gate: proceed on seven of every eight frames, skip on the
 * eighth. The seven-eighths arm of a difficulty-selected throttle family. `if (!loc_3131(m)) return;`
 *
 * LIVE-OUT: the proceed/skip boolean.
 */

import { FRAME } from "./names.js";

export function loc_3131(m) {
  const { mem8 } = m;
  return (mem8[FRAME] & 7) !== 7;
}
