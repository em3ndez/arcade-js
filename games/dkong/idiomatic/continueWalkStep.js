// SPDX-License-Identifier: GPL-3.0-only
/**
 * continueWalkStep — the walk-continuation arm: spend one frame of an in-progress step by counting
 * MARIO_MOVE_STEP_TIMER down (0 wraps to 255), then refresh Mario's hardware sprite record.
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER and the four sprite-record bytes.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function continueWalkStep(m) {
  const { mem8 } = m;

  mem8[MARIO_MOVE_STEP_TIMER] = mem8[MARIO_MOVE_STEP_TIMER] - 1;

  return writeMarioSpriteRecord(m);
}
