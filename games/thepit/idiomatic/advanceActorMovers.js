// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorMovers — advance the two-sprite actor's record(s) through the shared
 * move/collision driver, then stage its sprite records for display.
 *
 * Per-frame update for the two-sprite actor in its late/travel phase. The driver works
 * out of one fixed working block, so each record is advanced the same way: copy the
 * 17-byte record into the working block, run the driver to step and collide it in place,
 * then copy the result back. The primary record always advances; the twin advances only
 * while its gate byte is set. Either way the routine finishes by staging both sprite
 * records so the freshly-advanced positions draw next frame. Touches only work RAM.
 */

import { ENEMY3_X, ENEMY3_TWIN_X, TREASURE_COLLECTED, ENEMY_WORK_X } from "./names.js";
import { stepEnemyMover } from "./stepEnemyMover.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

// Records are 17 bytes; primary and twin sit back to back.
const RECORD_SIZE = 17;

/** Advance one record through the driver: copy into the working block, run, copy back. */
function driveRecordThroughMover(m, recordBase) {
  const { mem8 } = m;
  for (let i = 0; i < RECORD_SIZE; i++) mem8[ENEMY_WORK_X + i] = mem8[recordBase + i];
  stepEnemyMover(m);
  for (let i = 0; i < RECORD_SIZE; i++) mem8[recordBase + i] = mem8[ENEMY_WORK_X + i];
}

export function advanceActorMovers(m) {
  const { mem8 } = m;

  // The primary actor record always steps this frame.
  driveRecordThroughMover(m, ENEMY3_X);

  // The twin record steps too only while its gate is set.
  if (mem8[TREASURE_COLLECTED] !== 0) driveRecordThroughMover(m, ENEMY3_TWIN_X);

  // Both paths finish by staging the two sprite records for the display.
  return stageActorSpriteRecords(m);
}
