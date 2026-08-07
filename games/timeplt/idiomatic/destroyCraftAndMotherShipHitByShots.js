// SPDX-License-Identifier: GPL-3.0-only
/**
 * destroyCraftAndMotherShipHitByShots — run this era's two shot sweeps: the six shots against the five ordinary targets
 * first, then the same six shots against the one standing object that keeps its state byte and
 * its screen position apart from every record.
 *
 * The first sweep is handed its runs, its counts and its box outright, and the two cursor cells
 * it reloads between passes are staged here beforehand so the runs it restarts on are the ones
 * chosen here.
 *
 * The second sweep runs only while the standing object's state byte holds the live code, and its
 * box is not the first's: far wider on the second axis, always, but on the first axis a shade
 * NARROWER than the first sweep's — except in the first and last eras, where that one axis is
 * widened past it instead. A shot that reaches the object marks BOTH as destroyed and posts a
 * score, and then the sweep carries on through the remaining shots without re-testing the
 * object, so several shots arriving in one frame are each paid for. LIVE-OUT: memory-only.
 */

import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { ERA_INDEX, MOTHER_SHIP_STATE } from "./names.js";
import { u8 } from "../../../core/int.js";

const SHOT_RECORDS = 0xaa80;
const SHOTS = 6;
const RECORD_STRIDE = 16;
const TARGET_RECORDS = 0xa850;
const TARGET_ENTRIES = 0xaa1a;
const TARGETS = 5;
const TARGET_REACH = 7;
const TARGET_SPAN = 15;

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;

const STANDING_FIRST_AXIS = 0xaa24;
const STANDING_SECOND_AXIS = 0xaa55;

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
  mem16[TARGET_RECORD_CURSOR] = TARGET_RECORDS;
  mem16[TARGET_ENTRY_CURSOR] = TARGET_ENTRIES;
  destroyTargetsHitByShots(
    m, SHOT_RECORDS, TARGET_ENTRIES, TARGET_RECORDS,
    TARGETS, TARGETS, SHOTS, TARGET_REACH, TARGET_SPAN,
  );

  const wide = WIDE_ERAS.includes(mem8[ERA_INDEX]);
  const reach = wide ? WIDE_REACH : NARROW_REACH;
  const span = wide ? WIDE_SPAN : NARROW_SPAN;
  if (mem8[MOTHER_SHIP_STATE] !== LIVE) return;

  let shot = SHOT_RECORDS;
  for (let left = SHOTS; left !== 0; left--) {
    if (mem8[shot + STATE] === LIVE &&
      within(mem8[STANDING_FIRST_AXIS], mem8[shot + SHOT_FIRST_AXIS], reach, span) &&
      within(mem8[STANDING_SECOND_AXIS], mem8[shot + SHOT_SECOND_AXIS],
        SECOND_AXIS_REACH, SECOND_AXIS_SPAN)) {
      mem8[MOTHER_SHIP_STATE] = DESTROYED;
      mem8[shot + STATE] = DESTROYED;
      postChainedHitScore(m);
    }
    shot = nextRecord(shot);
  }
}
