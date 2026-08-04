// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectConveyorStepAndMoveMario — pick the drift step for this platform row by Mario's X,
 * then move him.
 *
 * One arm of the moving-platform row mover — the row whose Mario Y is 0x78. Object-2's
 * signed drift step is published as two shadow bytes, a positive arm and a negative arm, and
 * Mario's current X selects which one applies: from the far-right half of the range
 * (X >= 0x80) the positive step is used, otherwise the negative step. The chosen step is
 * handed to the shared X mover as the drift velocity, which advances Mario's X by it and
 * holds him inside the horizontal limits. Mario's prior X carries through unchanged as the
 * mover's other input.
 *
 * 50m is the conveyor board, so what this arm does on screen is carry Mario along a running
 * conveyor.
 *
 * LIVE-OUT: memory-only — Mario's X and his sprite record, both written inside the mover.
 * The prior X arrives in a register from the caller, and nothing downstream reads anything
 * this routine leaves behind.
 */

import { M50_OBJ2_STEP_POS, M50_OBJ2_STEP_NEG } from "./names.js";
import { moveMarioX } from "./moveMarioX.js"; // advance X by velocity, then clamp

export function selectConveyorStepAndMoveMario(m) {
  const { regs, mem } = m;

  // Mario's X selects the sign of object-2's published drift step: the far-right half of the
  // range (X >= 0x80) takes the positive-step shadow, the left half takes the negative one.
  const step = regs.b >= 0x80 ? mem.read8(M50_OBJ2_STEP_POS) : mem.read8(M50_OBJ2_STEP_NEG);

  // Hand the chosen step to the shared X mover as the drift velocity; Mario's prior X stays
  // in its register as the mover's other input.
  regs.a = step;
  moveMarioX(m);
}
