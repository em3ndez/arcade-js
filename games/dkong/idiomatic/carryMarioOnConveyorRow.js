// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioOnConveyorRow — carry Mario along whichever 50m conveyor (moving-platform) row
 * he is standing on.  ROM 0x2AD3.
 *
 * The 50m board runs three horizontally-drifting platform objects, one per platform row,
 * and each publishes a signed X-step for the frame (the three step publishers run just
 * before this in the object update). This routine is the mover those steps feed: it reads
 * which row Mario is on from his Y and, when he is standing on one of the three rows, carries
 * his X by that row's object step so he rides the platform. If his Y is on no moving-platform
 * row he is not carried and the routine does nothing.
 *
 * Mario's current X is the shared prior-X input to whichever mover runs, so it is read up
 * front and carried across as the mover's other input. The row dispatch is by exact Y:
 *   - Y == 0x50 (object-1 row): carry by object-1's published step.
 *   - Y == 0x78 (object-2 row): object-2 publishes a +/- pair, and selectConveyorStepAndMoveMario
 *     selects the arm by Mario's X before carrying him.
 *   - Y == 0xC8 (object-3 row): carry by object-3's published step.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the movers take honest params): both movers still
 * read Mario's prior X from a register, so this routine loads it exactly as the oracle's call
 * site does (Mario's current X into the shared prior-X register), and loads the selected step
 * into the velocity register before each direct moveMarioX call the same way.
 *
 * GROUNDED (DK understanding pass 5, independent confirmer): reads the named MARIO_X / MARIO_Y
 * and the M50_OBJ{1,2,3}_STEP 50m step shadows — whose own ram.js comments name their reader
 * "the 50m platform/object mover" — and dispatches Mario's horizontal carry by the exact
 * conveyor row his Y sits on. 50m = conveyors (ram.js "2=50m conveyors"; mechanisms.md "cement
 * pans on belts"); the object-2 arm is the already-English sibling selectConveyorStepAndMoveMario
 * (0x2AF6), which commits the family to the conveyor vocabulary. This is the Mario-CARRY mover
 * (reads MARIO_X/Y + named step shadows), not the step-DRIVER trio, so the M50 "which on-screen
 * object" sprite-record caution does not apply. Caller sub_25f2 runs the three step publishers
 * then this.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ad3.test.js.
 * GATE:     crafted-entry — attract only plays 25m, so the 50m moving-platform mover is never
 *           dispatched (0 real 0x2AD3 dispatches in 3000 attract frames), so entries are
 *           crafted on a real attract base. Each of the three rows plus off-row Ys is swept
 *           over all 256 prior-X values x both board parities, with DISTINCT step bytes in the
 *           four shadow cells so a wrong row-to-step pick moves Mario's X the wrong way; the
 *           prior-X sweep drives, through the movers, every position-gate verdict and edge
 *           nudge (and both selector arms on the object-2 row). The dropped tail-jump ret
 *           bracket's dead STACK_SCRATCH is excluded from the RAM diff. Teeth: a dropped
 *           prior-X marshal, a swapped row-to-step pick, and a missing off-row guard. Reached
 *           via sub_25f2.
 * LIVE-OUT: memory-only (MARIO_X, MARIO_SPRITE_RECORD, both written inside the movers). The
 *           prior X is marshalled into a register for the still-register-ABI movers; nothing
 *           downstream reads a register or flag this routine leaves — it tail-returns.
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), M50_OBJ1_STEP (0x63A3), M50_OBJ3_STEP (0x63A6)
 *           — from ram.js. Object-2's two step shadows (M50_OBJ2_STEP_POS/NEG) are read inside
 *           the selectConveyorStepAndMoveMario arm; MARIO_SPRITE_RECORD is written by the
 *           moveMarioX callee.
 */

import { MARIO_X, MARIO_Y, M50_OBJ1_STEP, M50_OBJ3_STEP } from "./ram.js";
import { moveMarioX } from "./moveMarioX.js"; // ROM 0x2B02 — advance X by velocity + clamp
import { selectConveyorStepAndMoveMario } from "./selectConveyorStepAndMoveMario.js";     // ROM 0x2AF6 — object-2 row: X-select the step, then move

export function carryMarioOnConveyorRow(m) {
  const { regs, mem } = m;

  // Mario's current X is the prior-X input every mover adds its step to; hand it across in
  // the register the still-register-ABI movers read it from.
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
    // Object-2 row — object-2 publishes a +/- pair; selectConveyorStepAndMoveMario picks the
    // arm by Mario's X.
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
