// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioOnConveyorRow — carry Mario along whichever 50m conveyor (moving-platform) row
 * he is standing on.
 *
 * The 50m board runs three horizontally-drifting platform objects, one per platform row, and
 * each publishes a signed X-step for the frame; those three step publishers run just before
 * this in the object update. This routine is the mover those steps feed: it reads which row
 * Mario is on from his Y and, when he is standing on one of the three rows, carries his X by
 * that row's object step so he rides the platform. If his Y is on no moving-platform row he
 * is not carried and the routine does nothing.
 *
 * Mario's current X is the shared prior-X input to whichever mover runs, so it is read up
 * front and staged where the movers read it. The row dispatch is by EXACT Y — one height per
 * object, not a band:
 *   - the object-1 row: carry by object-1's published step.
 *   - the object-2 row: object-2 publishes a +/− pair, and that row's own arm selects between
 *     them by Mario's X before carrying him.
 *   - the object-3 row: carry by object-3's published step.
 *
 * Both movers still read Mario's prior X from a register, so this routine stages it there,
 * and stages the selected step in the velocity register before each move.
 *
 * LIVE-OUT: memory-only — Mario's X and his sprite record, both written inside the movers.
 */

import { MARIO_X, MARIO_Y, M50_OBJ1_STEP, M50_OBJ3_STEP } from "./names.js";
import { moveMarioX } from "./moveMarioX.js"; // advance X by the staged step, then clamp
import { selectConveyorStepAndMoveMario } from "./selectConveyorStepAndMoveMario.js";     // object-2 row: X-select the step, then move

export function carryMarioOnConveyorRow(m) {
  const { regs, mem } = m;

  // Mario's current X is the prior-X input every mover adds its step to; stage it in the
  // register the movers read it from.
  regs.b = mem.read8(MARIO_X);

  // Which moving-platform row is Mario standing on? His Y band selects the object whose
  // published step carries him this frame.
  const y = mem.read8(MARIO_Y);

  if (y === 0x50) {
    // Object-1 row — carry by object-1's published step.
    regs.a = mem.read8(M50_OBJ1_STEP);
    moveMarioX(m);
    return;
  }
  if (y === 0x78) {
    // Object-2 row — object-2 publishes a +/− pair; that row's arm picks between them by
    // Mario's X.
    selectConveyorStepAndMoveMario(m);
    return;
  }
  if (y === 0xc8) {
    // Object-3 row — carry by object-3's published step.
    regs.a = mem.read8(M50_OBJ3_STEP);
    moveMarioX(m);
    return;
  }

  // Mario is on no moving-platform row — he is not carried.
}
