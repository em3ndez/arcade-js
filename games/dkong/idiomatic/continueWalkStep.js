// SPDX-License-Identifier: GPL-3.0-only
/**
 * continueWalkStep — carry an in-progress walk step one frame further.
 *
 * The continuation arm of the horizontal walk. While Mario's sub-step timer is still
 * running, each walk direction routes through the shared X advance — which shifts him one
 * pixel along X and re-snaps his Y to the sloped girder on 25m — and falls through here to
 * spend one frame of the step: knock the sub-step timer (MARIO_MOVE_STEP_TIMER) down by
 * one, then refresh Mario's hardware sprite record. When the timer reaches 0 on a later
 * frame the walk advances to its next animation frame and re-arms the timer instead of
 * coming here.
 *
 * Reached only as the tail of that shared X advance, inside the interruptible per-frame
 * movement cascade.
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER and the four sprite-record bytes. The
 * successor consumes nothing this routine leaves behind.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function continueWalkStep(m) {
  const { mem } = m;

  // Spend one frame of the in-progress move: count the sub-step timer down (0 wraps to
  // 255, the byte store truncating the way the hardware does).
  mem.write8(MARIO_MOVE_STEP_TIMER, mem.read8(MARIO_MOVE_STEP_TIMER) - 1);

  // Shared mover tail: refresh Mario's hardware sprite record, then return to the cascade.
  return writeMarioSpriteRecord(m);
}
