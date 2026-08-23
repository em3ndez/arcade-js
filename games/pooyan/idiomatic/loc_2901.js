// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { advanceTileAnimForwardOnOdd } from "./advanceTileAnimForwardOnOdd.js";
import { loc_23a1 } from "./loc_23a1.js";
import { loc_250f } from "./loc_250f.js";
import { clearActorArenaAndCounters } from "./clearActorArenaAndCounters.js";
import { loc_2b9a } from "./loc_2b9a.js";
import { queueRoundVariantSoundRun } from "./queueRoundVariantSoundRun.js";
import {
  TILE_ANIM_CURSOR,
  SHAPE_TABLE_2D59,
  FIELD_ATTRIB_SRC_C,
  FIELD_ATTRIB_REF_2980,
} from "./names.js";
/**
 * loc_2901 — lead-actor state-0 step for the record based at IX. Resets the frame hold and drives
 * the base Y down. While still above the floor it refreshes the derived sprite Ys, and unless the
 * tile-anim cursor is holding it advances the script and tails into the phase render. On reaching
 * the floor it loads the landing shape, reseeds the record, and runs two integrity self-checks over
 * the field-attribute source block: a wrong 0x20-byte sum re-enters the teardown handler, a wrong
 * reversed-reference byte re-enters the formation tick, and a clean pass emits the round-select run.
 *
 * LIVE-OUT: none — the dispatch epilogue reads the result from memory, not a register.
 */

const FLOOR_Y = 0xdc; // base Y at/after which the actor lands
const SCRIPT_HOLD = 0xf9; // tile-anim cursor value that freezes the script
const CHECK_LEN = 0x20; // bytes covered by each integrity pass
const CHECK_SUM = 0x63; // expected 8-bit sum of the source block

export function loc_2901(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x11] = 0x01; // reset the frame hold
  mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // advance the base Y downward

  if (mem8[rec + 0x04] < FLOOR_Y) {
    deriveStackedSpriteYs(m); // refresh the three derived sprite Ys
    if (mem8[TILE_ANIM_CURSOR] === SCRIPT_HOLD) return; // script held
    advanceTileAnimForwardOnOdd(m); // advance the script pointer
    return loc_23a1(m); // phase render tail
  }

  // reached the floor: load the landing shape, then reseed the record
  loc_250f(m, SHAPE_TABLE_2D59, rec);
  mem8[rec + 0x11] = 0x0c;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance the actor state
  mem8[rec + 0x04] = mem8[rec + 0x04] - 0x03;
  mem8[rec + 0x1c] = 0;
  mem8[rec + 0x1e] = 0;

  // integrity pass A: the source block's 8-bit sum must match
  let sum = 0;
  for (let i = 0; i < CHECK_LEN; i++) sum = u8(sum + mem8[FIELD_ATTRIB_SRC_C + i]);
  if (sum !== CHECK_SUM) return clearActorArenaAndCounters(m);

  // integrity pass B: the second half must match the reversed reference block
  for (let i = 0; i < CHECK_LEN; i++) {
    if (mem8[FIELD_ATTRIB_REF_2980 - 1 - i] !== mem8[FIELD_ATTRIB_SRC_C + CHECK_LEN + i]) {
      return loc_2b9a(m);
    }
  }

  queueRoundVariantSoundRun(m); // emit the round-select tile run
}
