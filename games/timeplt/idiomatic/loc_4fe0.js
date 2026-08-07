// SPDX-License-Identifier: GPL-3.0-only
/** loc_4fe0 — sweep six slots for one that a single roaming thing has reached, and destroy both.
 *
 * The roaming thing has one state byte and one pair of coordinates, all at fixed cells; unless its
 * state byte holds the live code the sweep does not run at all. Each slot must hold the live code
 * too, and both of its coordinates must fall inside a box centred on the roamer. The box is not
 * square and its first axis is not constant: two of the era values widen that axis, which is the
 * only thing the era decides here. A slot that passes takes the destroyed code, the roamer takes
 * it as well, and the chained hit score is posted for it. The sweep does NOT stop there — it runs
 * the remaining slots with the roamer already destroyed, so one pass can pay for several. Slots
 * are stepped a record at a time WITHOUT leaving their page. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { ERA_INDEX, MOTHER_SHIP_STATE } from "./names.js";
import { postChainedHitScore } from "./postChainedHitScore.js";

const SLOTS = 0xaa80;
const SLOT_COUNT = 6;
const RECORD_STRIDE = 16;
const STATE = 0;
const SLOT_FIRST_AXIS = 6;
const SLOT_SECOND_AXIS = 4;

const ROAMER_FIRST_AXIS = 0xaa24;
const ROAMER_SECOND_AXIS = 0xaa55;

const LIVE = 255;
const DESTROYED = 240;

const WIDE_ERAS = [0, 4];
const FIRST_AXIS_REACH_WIDE = 8;
const FIRST_AXIS_SPAN_WIDE = 17;
const FIRST_AXIS_REACH = 6;
const FIRST_AXIS_SPAN = 13;
const SECOND_AXIS_REACH = 23;
const SECOND_AXIS_SPAN = 31;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

export function loc_4fe0(m) {
  const { mem8 } = m;
  const wide = WIDE_ERAS.includes(mem8[ERA_INDEX]);
  const reach = wide ? FIRST_AXIS_REACH_WIDE : FIRST_AXIS_REACH;
  const span = wide ? FIRST_AXIS_SPAN_WIDE : FIRST_AXIS_SPAN;

  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;

  let slot = SLOTS;
  for (let left = SLOT_COUNT; left !== 0; left--) {
    if (
      mem8[u16(slot + STATE)] === LIVE &&
      within(mem8[ROAMER_FIRST_AXIS], mem8[u16(slot + SLOT_FIRST_AXIS)], reach, span) &&
      within(mem8[ROAMER_SECOND_AXIS], mem8[u16(slot + SLOT_SECOND_AXIS)],
        SECOND_AXIS_REACH, SECOND_AXIS_SPAN)
    ) {
      mem8[MOTHER_SHIP_STATE] = DESTROYED;
      mem8[u16(slot + STATE)] = DESTROYED;
      postChainedHitScore(m);
    }
    slot = (slot & 0xff00) | u8(slot + RECORD_STRIDE);
  }
}
