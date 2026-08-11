// SPDX-License-Identifier: GPL-3.0-only
/** destroyPlayerAndMotherShipOnContact — destroy two roaming things at once when one has reached the other.
 * Both must be live (each has a state byte at a fixed cell) and their coordinates must fall inside a box centred on
 * the second, taller than wide and centred off-square on the taller axis. When it holds, both state bytes take the
 * destroyed code, a third cell beside them is cleared, and the chained hit score is posted -- reached by transfer,
 * not call, so that routine's return carries it. Any of the four tests failing leaves all untouched. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { MOTHER_SHIP_ENTRY, MOTHER_SHIP_HOLD_COUNTER, MOTHER_SHIP_SPRITE_Y, MOTHER_SHIP_STATE, PLAYER_ENTRY, PLAYER_STATE } from "./names.js";

const ENTRY_SECOND_AXIS = 49;


const LIVE = 255;
const DESTROYED = 240;

const FIRST_AXIS_REACH = 8;
const FIRST_AXIS_SPAN = 17;
const SECOND_AXIS_REACH = 25;
const SECOND_AXIS_SPAN = 35;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

export function destroyPlayerAndMotherShipOnContact(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;
  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;
  if (!within(mem8[MOTHER_SHIP_ENTRY], mem8[PLAYER_ENTRY], FIRST_AXIS_REACH, FIRST_AXIS_SPAN)) return;
  if (
    !within(mem8[MOTHER_SHIP_SPRITE_Y], mem8[u16(PLAYER_ENTRY + ENTRY_SECOND_AXIS)],
      SECOND_AXIS_REACH, SECOND_AXIS_SPAN)
  ) {
    return;
  }

  mem8[PLAYER_STATE] = DESTROYED;
  mem8[MOTHER_SHIP_STATE] = DESTROYED;
  mem8[MOTHER_SHIP_HOLD_COUNTER] = 0;
  postChainedHitScore(m);
}
