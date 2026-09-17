// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_311b — frame-phase caller-skip gate: proceed on five of every eight frames, `(FRAME & 7) < 5`.
 * The five-eighths arm of a difficulty-selected throttle family. `if (!loc_311b(m)) return;`
 *
 * LIVE-OUT: the proceed/skip boolean.
 */

import { FRAME } from "./names.js";

export function loc_311b(m) {
  return (m.mem8[FRAME] & 7) < 5;
}
