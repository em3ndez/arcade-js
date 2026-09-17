// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3126 — frame-phase caller-skip gate: proceed on three of every four frames. The
 * three-quarters arm of a difficulty-selected throttle family. `if (!loc_3126(m)) return;`
 *
 * LIVE-OUT: the proceed/skip boolean.
 */

import { FRAME } from "./names.js";

export function loc_3126(m) {
  return (m.mem8[FRAME] & 0x03) !== 0x03;
}
