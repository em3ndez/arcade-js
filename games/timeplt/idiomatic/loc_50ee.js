// SPDX-License-Identifier: GPL-3.0-only
/** loc_50ee — destroy two roaming things at once when one has reached the other.
 *
 * Both must be live — each has its own state byte at a fixed cell — and their two coordinates must
 * fall inside a box centred on the second one. The first thing's coordinates are kept as a sprite
 * entry, the two halves far apart in the same block; the second's are two fixed cells. The box is
 * taller than it is wide and is centred off-square on the taller axis. When it holds, both state
 * bytes take the destroyed code, a third cell beside them is cleared, and the chained hit score is
 * posted, which this entry reaches by transferring rather than calling so that routine's own
 * return carries it. Any one of the four tests failing leaves everything untouched.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { PLAYER_STATE } from "./names.js";

const ENTRY = 0xaa10;
const ENTRY_SECOND_AXIS = 49;

const SECOND_STATE = 0xa8a0;
const CLEARED_BESIDE = 0xa8a4;
const SECOND_FIRST_AXIS = 0xaa24;
const SECOND_SECOND_AXIS = 0xaa55;

const LIVE = 255;
const DESTROYED = 240;

const FIRST_AXIS_REACH = 8;
const FIRST_AXIS_SPAN = 17;
const SECOND_AXIS_REACH = 25;
const SECOND_AXIS_SPAN = 35;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

export function loc_50ee(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;
  if (mem8[SECOND_STATE] !== LIVE) return;
  if (!within(mem8[SECOND_FIRST_AXIS], mem8[ENTRY], FIRST_AXIS_REACH, FIRST_AXIS_SPAN)) return;
  if (
    !within(mem8[SECOND_SECOND_AXIS], mem8[u16(ENTRY + ENTRY_SECOND_AXIS)],
      SECOND_AXIS_REACH, SECOND_AXIS_SPAN)
  ) {
    return;
  }

  mem8[PLAYER_STATE] = DESTROYED;
  mem8[SECOND_STATE] = DESTROYED;
  mem8[CLEARED_BESIDE] = 0;
  postChainedHitScore(m);
}
