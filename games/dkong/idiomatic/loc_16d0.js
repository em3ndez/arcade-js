// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16d0 — the "hit the boundary" arm of the group-slide tail: set object #1's reverse
 * countdown to 1, then fall into the shared motion tick. On an even frame that tick decrements
 * 1 -> 0, which reloads the period (0x80) and reverses the group's step direction this same
 * frame; on an odd frame the tick is skipped and the dispatcher re-clears the byte next frame.
 *
 * LIVE-OUT: memory-only. Tail-returns through the shared motion tick.
 */

import { stepKongWalk } from "./stepKongWalk.js";
import { M50_OBJ1_REVERSE_TIMER } from "./names.js";

export function loc_16d0(m) {
  const { mem8 } = m;
  mem8[M50_OBJ1_REVERSE_TIMER] = 0x01;
  stepKongWalk(m);
}
