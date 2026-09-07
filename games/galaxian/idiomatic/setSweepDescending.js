// SPDX-License-Identifier: GPL-3.0-only
/**
 * setSweepDescending — flip the formation's side-to-side march into its descending phase.
 *
 * WHAT IT IS
 *   A one-store leaf: it sets OBJ_SWEEP_DIRECTION (0x420d) to 1, the flag that tells the formation
 *   sway which way to step the anchor word each frame. One means "descending" — the swept 16-bit
 *   formation anchor loc_420e falls (its low byte decreases) on the next steps.
 *
 * ROLE IN THE MACHINE
 *   The whole alien block oscillates left-and-right by walking one shared anchor word one unit every
 *   four frames (see mechanisms.md "The formation sway"). advanceFormationSweepOscillator (0x090d)
 *   drives that walk and calls here at the turn-around: when the ascending anchor has climbed to the
 *   upper bound in FORMATION_X_BOUNDS, it sets the direction flag so the block reverses and marches
 *   back down. setSweepAscending (0x0983) is the mirror call made at the lower bound.
 *
 * ROM 0x097d.  Grounding: [seen] (OBJ_SWEEP_DIRECTION is [seen]).
 *
 * LIVE-OUT: mem8[OBJ_SWEEP_DIRECTION] = 1. No register contract.
 */
import { OBJ_SWEEP_DIRECTION } from "./names.js";

// Flag value selecting the descending (decrementing) sweep phase.
const DESCENDING = 1;

export function setSweepDescending(m) {
  const { mem8 } = m;
  // Upper bound reached: set the direction flag so the sway now steps the anchor downward (descending).
  mem8[OBJ_SWEEP_DIRECTION] = DESCENDING;
}
