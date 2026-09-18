// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioOnConveyorRow — carry Mario along whichever 50m conveyor row he stands on. Reads his
 * row from MARIO_Y by exact height and, on one of the three moving-platform rows, carries his X by
 * that row's published object step (the object-2 row selects between a +/- pair by Mario's X). On
 * no such row he is not carried. Mario's prior X is staged in the register every mover reads.
 *
 * LIVE-OUT: memory-only — Mario's X and his sprite record, both written inside the movers.
 */

import { MARIO_X, MARIO_Y, M50_OBJ1_STEP, M50_OBJ3_STEP } from "./names.js";
import { moveMarioX } from "./moveMarioX.js";
import { selectConveyorStepAndMoveMario } from "./selectConveyorStepAndMoveMario.js";

export function carryMarioOnConveyorRow(m) {
  const { regs, mem8 } = m;

  regs.b = mem8[MARIO_X]; // prior-X input every mover adds its step to

  const y = mem8[MARIO_Y];

  if (y === 0x50) {
    moveMarioX(m, mem8[M50_OBJ1_STEP]);
    return;
  }
  if (y === 0x78) {
    selectConveyorStepAndMoveMario(m);
    return;
  }
  if (y === 0xc8) {
    moveMarioX(m, mem8[M50_OBJ3_STEP]);
    return;
  }
}
