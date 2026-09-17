// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceMarioWalkX — advance Mario one pixel along a horizontal walk step.
 *
 * Shifts MARIO_X by the signed byte delta (1 right, 255 left, 0 held) and, on 25m (board 1) only,
 * re-snaps MARIO_Y to the sloped girder under the new X. Both paths tail into the shared walk-step
 * continuation, which spends one frame and refreshes Mario's sprite record.
 *
 * LIVE-OUT: memory-only — MARIO_X, MARIO_Y on 25m, and everything the continuation touches.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, MARIO_Y, BOARD } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { continueWalkStep } from "./continueWalkStep.js";

/** @param {number} delta  signed one-pixel walk step: 1 right, 255 left, 0 held. */
export function advanceMarioWalkX(m, delta) {
  const { mem8 } = m;

  const newX = u8(mem8[MARIO_X] + delta);
  mem8[MARIO_X] = newX;

  if (mem8[BOARD] === 1) {
    mem8[MARIO_Y] = snapYToGirder(newX, mem8[MARIO_Y], delta);
  }

  return continueWalkStep(m);
}
