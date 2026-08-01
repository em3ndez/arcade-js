// SPDX-License-Identifier: GPL-3.0-only
/**
 * continueWalkStep — carry an in-progress walk step one frame further.  ROM 0x1ceb.
 *
 * The continuation arm of the horizontal walk. While Mario's sub-step timer is still
 * running, the walk steppers (loc_1c8f / loc_1cab) route through loc_1cd2 — which shifts
 * him one pixel along X and re-snaps his Y to the sloped girder on 25m — and fall
 * through here to spend one frame of the step: knock the sub-step timer
 * (MARIO_MOVE_STEP_TIMER) down by one, then refresh Mario's hardware sprite record. When
 * the timer reaches 0 on a later frame, the steppers advance the walk animation and
 * re-arm it (see beginWalkStep).
 *
 * Reached only as loc_1cd2's tail, inside the interruptible per-frame movement cascade.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1ceb.test.js.
 * GATE:     crafted-entry — real captured 25m dispatches cover the single straight-line
 *           arm; crafted timer values (incl. 0, which wraps to 255) pin the decrement and
 *           the record refresh. Teeth: a wrong timer store and a skipped sprite refresh,
 *           each caught.
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER and the four sprite-record bytes. The
 *           successor consumes no register/flag this leaves; the oracle's residual
 *           A/HL/flags are dead ABI (pc/SP model the single tail return, supplied by the
 *           harness).
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F) — from ram.js. writeMarioSpriteRecord (0x1da6)
 *           called directly.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function continueWalkStep(m) {
  const { mem } = m;

  // Spend one frame of the in-progress move: count the sub-step timer down (0 wraps to
  // 255, the byte store truncating the way the hardware does).
  mem.write8(MARIO_MOVE_STEP_TIMER, mem.read8(MARIO_MOVE_STEP_TIMER) - 1);

  // Shared mover tail: refresh Mario's hardware sprite record, then return to the cascade.
  return writeMarioSpriteRecord(m);
}
