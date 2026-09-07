// SPDX-License-Identifier: GPL-3.0-only
/**
 * setSweepAscending — flip the formation's side-to-side march back into its ascending phase.
 *
 * WHAT IT IS
 *   A one-store leaf: it clears OBJ_SWEEP_DIRECTION (0x420d) to 0, the flag that tells the formation
 *   sway which way to step the anchor word each frame. Zero means "ascending" — the swept 16-bit
 *   formation anchor loc_420e climbs (its low byte increases) on the next steps.
 *
 * ROLE IN THE MACHINE
 *   The whole alien block oscillates left-and-right by walking one shared anchor word one unit every
 *   four frames (see mechanisms.md "The formation sway"). advanceFormationSweepOscillator (0x090d)
 *   drives that walk and calls here at the turn-around: when the descending anchor has fallen to the
 *   lower bound in FORMATION_X_BOUNDS, it clears the direction flag so the block reverses and marches
 *   the other way. setSweepDescending (0x097d) is the mirror call made at the upper bound.
 *
 * ROM 0x0983.  Grounding: [seen] (OBJ_SWEEP_DIRECTION is [seen]).
 *
 * LIVE-OUT: mem8[OBJ_SWEEP_DIRECTION] = 0. No register contract.
 */
import { OBJ_SWEEP_DIRECTION } from "./names.js";

export function setSweepAscending(m) {
  const { mem8 } = m;

  // Lower bound reached: clear the direction flag so the sway now steps the anchor upward (ascending).
  mem8[OBJ_SWEEP_DIRECTION] = 0;
}
