// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectConveyorStepAndMoveMario — the 50m conveyor arm of the moving-platform row mover (Mario Y
 * 0x78): pick object-2's signed drift step by Mario's X (X >= 0x80 -> positive shadow, else the
 * negative shadow), then hand it to the shared X mover as the drift velocity.
 *
 * LIVE-OUT: memory-only — Mario's X and his sprite record, written inside the mover.
 */

import { M50_OBJ2_STEP_POS, M50_OBJ2_STEP_NEG } from "./names.js";
import { moveMarioX } from "./moveMarioX.js";

export function selectConveyorStepAndMoveMario(m, b = m.regs.b) {
  const { regs, mem8 } = m;

  const step = b >= 0x80 ? mem8[M50_OBJ2_STEP_POS] : mem8[M50_OBJ2_STEP_NEG];

  regs.a = step;
  moveMarioX(m);
}
