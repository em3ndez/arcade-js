// SPDX-License-Identifier: GPL-3.0-only
/**
 * destroyCraftAndMotherShipHitByShots — run this era's two shot sweeps: six shots against the five
 * ordinary targets, then the same six against the one standing object (which keeps its state byte and
 * screen position apart from every record).
 *
 * The first sweep gets its runs, counts and box outright, with the two cursor cells it reloads between
 * passes staged here first. The second runs only while the standing object is live, with a different box
 * (wider on axis 2; on axis 1 a shade narrower, except first/last eras where it is widened past). A shot
 * reaching the object marks both destroyed, posts a score, then carries on without re-testing it, so
 * several shots in one frame are each paid for. LIVE-OUT: memory-only.
 */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0, ERA_INDEX, MOTHER_SHIP_ENTRY, MOTHER_SHIP_SPRITE_Y, MOTHER_SHIP_STATE, PLAYER_SHOT_ARRAY, SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";
import { u8 } from "../../../core/int.js";

const SHOTS = 6;
const RECORD_STRIDE = 16;
const TARGETS = 5;
const TARGET_REACH = 7;
const TARGET_SPAN = 15;



const STATE = 0;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;
const LIVE = 255;
const DESTROYED = 240;

const WIDE_ERAS = [0, 4];
const WIDE_REACH = 8;
const WIDE_SPAN = 17;
const NARROW_REACH = 6;
const NARROW_SPAN = 13;
const SECOND_AXIS_REACH = 23;
const SECOND_AXIS_SPAN = 31;

/** Two coordinates are close enough when their wrapped difference lands inside the box. */
const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

/** Advance a cursor a whole record on WITHOUT leaving its page — the carry is dropped. */
const nextRecord = (cursor) => (cursor & 0xff00) | u8(cursor + RECORD_STRIDE);

export function destroyCraftAndMotherShipHitByShots(m) {
  const { mem8, mem16 } = m;
  mem16[SCRATCH_PTR_B] = CRAFT_RECORD_SLOT0;
  mem16[SCRATCH_PTR_A] = CRAFT_ENTRY_SLOT0;
  destroyTargetsHitByShots(
    m, PLAYER_SHOT_ARRAY, CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0,
    TARGETS, TARGETS, SHOTS, TARGET_REACH, TARGET_SPAN,
  );

  const wide = WIDE_ERAS.includes(mem8[ERA_INDEX]);
  const reach = wide ? WIDE_REACH : NARROW_REACH;
  const span = wide ? WIDE_SPAN : NARROW_SPAN;
  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;

  let shot = PLAYER_SHOT_ARRAY;
  for (let left = SHOTS; left !== 0; left--) {
    if (mem8[shot + STATE] === LIVE &&
      within(mem8[MOTHER_SHIP_ENTRY], mem8[shot + SHOT_FIRST_AXIS], reach, span) &&
      within(mem8[MOTHER_SHIP_SPRITE_Y], mem8[shot + SHOT_SECOND_AXIS],
        SECOND_AXIS_REACH, SECOND_AXIS_SPAN)) {
      mem8[MOTHER_SHIP_STATE] = DESTROYED;
      mem8[shot + STATE] = DESTROYED;
      postChainedHitScore(m);
    }
    shot = nextRecord(shot);
  }
}
