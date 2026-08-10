// SPDX-License-Identifier: GPL-3.0-only
/** destroyMotherShipAndShotOnMutualHit — sweep the six shot slots for one that a single roaming thing has reached, and destroy both. The
 * roamer has one state byte and one coordinate pair at fixed cells; unless its state is live the sweep doesn't run.
 * Each slot must be live too, with both coordinates inside a box centred on the roamer -- not square, and its first
 * axis widened by two of the era values (the only thing the era decides here). A slot that passes takes the destroyed
 * code, the roamer takes it too, and the chained hit score is posted. The sweep runs the remaining slots with the
 * roamer already destroyed, so one pass can pay for several. Slots step a record at a time without leaving their page.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { ERA_INDEX, MOTHER_SHIP_STATE, PLAYER_SHOT_ARRAY } from "./names.js";
import { postChainedHitScore } from "./postChainedHitScore.js";

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

export function destroyMotherShipAndShotOnMutualHit(m) {
  const { mem8 } = m;
  const wide = WIDE_ERAS.includes(mem8[ERA_INDEX]);
  const reach = wide ? FIRST_AXIS_REACH_WIDE : FIRST_AXIS_REACH;
  const span = wide ? FIRST_AXIS_SPAN_WIDE : FIRST_AXIS_SPAN;

  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;

  let slot = PLAYER_SHOT_ARRAY;
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
