// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceMarioWalkX — advance Mario one pixel along a horizontal walk step.
 *
 * The X arm of the per-frame walk mover. It shifts Mario's X position by the signed walk delta
 * and, on 25m only, re-snaps his Y to the sloped girder now under his new X, before falling
 * through into the shared walk-step continuation.
 *
 * `delta` is the signed one-pixel step the walk stepper hands in: 1 moving right, 255 (i.e. -1)
 * moving left, 0 for a held frame. It is added to MARIO_X as a byte, wrapping the way the hardware
 * does.
 *
 * The girder re-snap runs only on the 25m board; on the conveyor, elevator and rivet boards Y is
 * left as it was and control goes straight to the continuation. When it does run, the girder snap
 * steps Mario's Y by one unit as his new X crosses a girder cell edge — a pure function of the new
 * X, the current Y and the walk direction — and the result goes back into MARIO_Y.
 *
 * Both paths end by tailing into the walk-step continuation, which spends one frame of the move
 * and refreshes Mario's sprite record.
 *
 * LIVE-OUT: memory-only — MARIO_X, MARIO_Y on 25m, and everything the continuation touches.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, MARIO_Y, BOARD } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { continueWalkStep } from "./continueWalkStep.js";

/**
 * @param {object} m  the machine
 * @param {number} delta  signed one-pixel walk step: 1 right, 255 left, 0 held.
 */
export function advanceMarioWalkX(m, delta) {
  const { mem } = m;

  // Shift Mario one pixel along X by the signed walk delta (byte-wrapping).
  const newX = u8(mem.read8(MARIO_X) + delta);
  mem.write8(MARIO_X, newX);

  // Only 25m (board 1) re-snaps Y to the sloped girder under the new X; the other
  // boards leave Y alone and go straight to the walk-step continuation.
  if (mem.read8(BOARD) === 1) {
    mem.write8(MARIO_Y, snapYToGirder(newX, mem.read8(MARIO_Y), delta));
  }

  // Spend one frame of the in-progress step and refresh Mario's sprite record.
  return continueWalkStep(m);
}
