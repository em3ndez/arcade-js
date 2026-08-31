// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5b99 } from "./loc_5b99.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * scanEnemyRecordsForCollision — sweep the per-record collision check across the six enemy-actor records.
 *
 * Walks the record table (stride 0x18) running the collision check on each record in turn. The
 * first record that registers a hit short-circuits the sweep and returns immediately; with no hit
 * all six records are checked. The early return reproduces the frozen form's caller-skip unwind:
 * a hit there discards this sweep's frame and returns straight to its caller.
 *
 * LIVE-OUT: memory only — the collision check's writes; this driver's registers are loop
 * artifacts and no caller reads them.
 */
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 6;

export function scanEnemyRecordsForCollision(m) {
  let record = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    if (!loc_5b99(m, record)) return; // hit -> abort the sweep
    record = u16(record + RECORD_STRIDE);
  }
}
