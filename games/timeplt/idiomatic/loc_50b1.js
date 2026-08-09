// SPDX-License-Identifier: GPL-3.0-only
/** loc_50b1 — pick the collision box for the mutual kill of the player and one fixed two-slot
 * target by the era, then run it. In two of the eras the wider first-axis box applies and control
 * transfers to that check; in the rest the same destruction runs here with a narrower first-axis
 * box. Both things must be live and their coordinates must fall inside the box; when they do, both
 * take the destroyed code, the cell beside them is cleared, and the chained hit score is posted.
 * Any one test failing leaves everything untouched. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { loc_50ee } from "./loc_50ee.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { ERA_INDEX, PLAYER_STATE, MOTHER_SHIP_STATE } from "./names.js";

const ENTRY = 0xaa10;
const ENTRY_SECOND_AXIS = 49;
const CLEARED_BESIDE = 0xa8a4;
const SECOND_FIRST_AXIS = 0xaa24;
const SECOND_SECOND_AXIS = 0xaa55;

const WIDE_WINDOW_ERAS = [0, 4];
const LIVE = 255;
const DESTROYED = 240;

const FIRST_AXIS_REACH = 6;
const FIRST_AXIS_SPAN = 13;
const SECOND_AXIS_REACH = 25;
const SECOND_AXIS_SPAN = 35;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

export function loc_50b1(m) {
  const { mem8 } = m;
  if (WIDE_WINDOW_ERAS.includes(mem8[ERA_INDEX])) return loc_50ee(m);

  if (mem8[PLAYER_STATE] !== LIVE) return;
  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;
  if (!within(mem8[SECOND_FIRST_AXIS], mem8[ENTRY], FIRST_AXIS_REACH, FIRST_AXIS_SPAN)) return;
  if (
    !within(mem8[SECOND_SECOND_AXIS], mem8[u16(ENTRY + ENTRY_SECOND_AXIS)],
      SECOND_AXIS_REACH, SECOND_AXIS_SPAN)
  ) {
    return;
  }

  mem8[PLAYER_STATE] = DESTROYED;
  mem8[MOTHER_SHIP_STATE] = DESTROYED;
  mem8[CLEARED_BESIDE] = 0;
  postChainedHitScore(m);
}
