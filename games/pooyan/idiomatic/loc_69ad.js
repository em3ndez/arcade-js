// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_69c6 } from "./loc_69c6.js";
import { ENEMY_ACTOR_TABLE, OBJECT_STATE_RECORD_BASE } from "./names.js";
/**
 * loc_69ad — step eight paired descending-object records through the per-record stepper.
 *
 * Walks the enemy-actor table and the object-state record base in lockstep, one record
 * stride apart, advancing each (ix, iy) pair one motion step. The frozen layer stashes the
 * loop counter and stride in the shadow register set across the call; here they are plain
 * locals, so no per-record register juggling is needed.
 *
 * LIVE-OUT: memory only — a per-frame sweep whose caller consumes no result.
 */

const RECORD_STRIDE = 0x18; // bytes between one paired record and the next
const PAIR_COUNT = 8; //       number of (ix, iy) record pairs swept

export function loc_69ad(m) {
  let ix = ENEMY_ACTOR_TABLE;
  let iy = OBJECT_STATE_RECORD_BASE;
  for (let n = 0; n < PAIR_COUNT; n++) {
    loc_69c6(m, ix, iy);
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
