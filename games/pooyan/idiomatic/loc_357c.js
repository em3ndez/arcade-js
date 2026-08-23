// SPDX-License-Identifier: GPL-3.0-only
import {
  ACTIVE_LANE_COUNT,
  ROUND_COUNTER,
  ANIM_FRAME_COUNTER,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  TARGET_TILE_ROW_TABLE,
  ANIM_TABLE_3838,
  ANIM_TABLE_3856,
} from "./names.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_3617 } from "./loc_3617.js";
import { setActorAnimation } from "./setActorAnimation.js";
/**
 * loc_357c — target-tile resolver + state step for an actor record at IX.
 *
 * With no lane active it resolves the wanted tile from a per-frame table row (row picked by the
 * round flag, column by the anim frame counter). With a lane active it revives an alternate lane:
 * either compares the actor's current tile directly (rec+0x07 bit2 clear) or resolves from a second
 * table base. On an exact tile match it tails into the pre-spawn guard. Otherwise a tile below the
 * threshold returns; at or above it, the record is latched (rec+0x08) and pointed at one of two
 * animation scripts (chosen by rec+0x07 bit1).
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back.
 */
const BIT2 = 0x04; // rec+0x07 bit selecting the direct-compare re-entry
const BIT1 = 0x02; // rec+0x07 bit selecting the second animation script
const TILE_THRESHOLD = 0x14; // current tile below this returns without a step

export function loc_357c(m, ix = m.regs.ix) {
  const { mem8, mem16 } = m;

  let base;
  let column;
  let doLookup = true;

  if (mem8[ACTIVE_LANE_COUNT] !== 0) {
    if ((mem8[ix + 0x07] & BIT2) === 0) {
      doLookup = false; // direct-compare re-entry: skip the table lookup
    } else {
      base = mem16[ALT_TARGET_TABLE_PTR];
      column = mem8[SLOT_SPAWN_INDEX];
    }
  } else {
    const rowIndex = (mem8[ROUND_COUNTER] & 0x0f) >> 1;
    base = loc_0c45(m, rowIndex, TARGET_TILE_ROW_TABLE); // row base word
    column = mem8[ANIM_FRAME_COUNTER] & 0x07;
  }

  if (doLookup) {
    const [wanted] = loc_0020(m, base, column);
    if (mem8[ix + 0x06] === wanted) return loc_3617(m); // exact hit
  }

  if (mem8[ix + 0x06] < TILE_THRESHOLD) return; // below threshold
  mem8[ix + 0x08] = 0x01; // latch the state
  const script = mem8[ix + 0x07] & BIT1 ? ANIM_TABLE_3856 : ANIM_TABLE_3838;
  return setActorAnimation(m, ix, script);
}
