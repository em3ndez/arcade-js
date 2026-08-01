// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cd2 — advance Mario one pixel along a horizontal walk step.  ROM 0x1CD2.
 *
 * The X arm of the per-frame walk mover. It shifts Mario's X position by the signed
 * walk delta, and on 25m only re-snaps his Y to the sloped girder now under his new X,
 * before falling through into the shared walk-step continuation.
 *
 * `delta` is the signed one-pixel step the walk stepper (loc_1c8f / loc_1cab) hands in:
 * 1 moving right, 255 (i.e. -1) moving left, 0 for a held frame. It is added to MARIO_X
 * as a byte, wrapping the way the hardware does.
 *
 * The girder re-snap runs only on the 25m board (BOARD == 1); on the conveyor / elevator
 * / rivet boards Y is left as-is and control goes straight to the continuation. When it
 * does run, snapYToGirder steps Mario's Y one unit as his new X crosses a girder cell edge —
 * a pure function of the new X, the current Y, and the walk direction — and its result
 * is stored back into MARIO_Y.
 *
 * Both paths end by tailing into continueWalkStep, which spends one frame of the move
 * and refreshes Mario's sprite record.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1cd2.test.js.
 * GATE:     real captured 25m attract dispatches (BOARD == 1, moving right) + crafted
 *           entries for the non-25m skip arm, the leftward and held deltas, and the X
 *           sub-cell / Y-sentinel edges that make the girder snap act or hold. Teeth: an
 *           always-clamp twin (drops the BOARD guard), a wrong-X-delta twin, and a
 *           swapped snapYToGirder marshalling twin, each caught.
 * LIVE-OUT: memory-only — MARIO_X, MARIO_Y (25m only), and everything continueWalkStep
 *           touches. The oracle's residual registers/flags are dead ABI (pc/SP model the
 *           single tail return, supplied by the harness).
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), BOARD (0x6227) — from ram.js.
 *           snapYToGirder (0x2333) and continueWalkStep (0x1ceb) called directly.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, MARIO_Y, BOARD } from "./ram.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { continueWalkStep } from "./continueWalkStep.js";

/**
 * @param {import("../../machine.js").Machine} m
 * @param {number} delta  signed one-pixel walk step: 1 right, 255 left, 0 held.
 */
export function loc_1cd2(m, delta) {
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
