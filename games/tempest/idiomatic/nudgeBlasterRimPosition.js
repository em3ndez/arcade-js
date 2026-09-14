// SPDX-License-Identifier: GPL-3.0-only
import { DEPTH_CEILING, PLAYER_SEGMENT } from "./names.js";
import { foldStepIntoFraction } from "./foldStepIntoFraction.js";

/**
 * nudgeBlasterRimPosition — advance the blaster's rim position by one signed sub-step, then clamp it into
 * the tube. ROM 0xb0ab.
 *
 * Role in the machine: the player's blaster rides the rim of the tube, one position per lane. This routine
 * is what moves it. It takes the current rim position (PLAYER_SEGMENT / loc_200), folds in the pending
 * signed fractional step through foldStepIntoFraction — which integrates the sub-step and carries whole-lane
 * motion out — then keeps the result inside the playable window [0, DEPTH_CEILING] so the blaster can never
 * slide off either end of the lane run.
 *
 * Behaviour: foldStepIntoFraction returns the nudged position in A. A byte >= 0x80 is a negative underflow
 * (stepped below the first lane) and floors to 0; a byte at or past the ceiling cell (DEPTH_CEILING /
 * loc_127) pins to the ceiling. The clamped value is written back to PLAYER_SEGMENT and handed to the caller
 * in both A and Y.
 *
 * Live-out: PLAYER_SEGMENT (the new rim position), plus registers A = Y = the clamped value. Grounding:
 * [seen].
 */
export function nudgeBlasterRimPosition(m) {
  const { mem8 } = m;
  let a = foldStepIntoFraction(m, mem8[PLAYER_SEGMENT]);
  if (a >= 0x80) {
    a = 0x00; // negative floors to zero
  } else if (a >= mem8[DEPTH_CEILING]) {
    a = mem8[DEPTH_CEILING]; // clamp to the ceiling
  }
  mem8[PLAYER_SEGMENT] = a;
  // A and Y are both live-outs (= the clamped value) — both ride the return.
  return [(m.regs.a = a), (m.regs.y = a)];
}
