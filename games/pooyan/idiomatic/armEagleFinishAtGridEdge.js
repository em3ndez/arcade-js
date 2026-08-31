// SPDX-License-Identifier: GPL-3.0-only
import { ENEMY_TARGET_REC0, EAGLE_FINISH_FLAG } from "./names.js";
import { advanceEaglePhaseAndClearAim } from "./advanceEaglePhaseAndClearAim.js";
/**
 * armEagleFinishAtGridEdge -- the eagle bonus-wave grid-advance guard (ROM 0x7287-0x7291, [seen]).
 *
 * WHAT IT IS
 *   During the eagle bonus stage the eagle marches sideways across a row of grid slots, one grid
 *   cell every few frames, while the approach machine paints its position marker and drives the aim
 *   indicator. This routine is the guard that decides, each time it is consulted, whether that march
 *   is still in progress or has just run off the far edge of the grid.
 *
 * ROLE IN THE MACHINE
 *   It reads the eagle's single advancing grid coordinate and forks on it:
 *     - Short of the edge: it simply hands the coordinate straight back, unchanged. The approach
 *       machine uses that value to derive how far along the row the eagle is (its grid loop count),
 *       so returning it keeps the eagle stepping frame after frame.
 *     - At the edge: the sweep is finished. It arms the grid-advance done latch and runs the
 *       phase-reset epilogue, which tears down the aim state and advances the eagle wave to its next
 *       outer phase. The coordinate handed back on this path is 0.
 *
 * LIVE-OUT
 *   The accumulator (A): the advancing grid coordinate on the short-of-edge path (consumed by the
 *   approach machine as its grid loop count), or 0 once the edge has been reached and the reset has
 *   run. It also leaves EAGLE_FINISH_FLAG raised on that edge path (see below).
 */
// The advancing grid coordinate lives at field +4 of the enemy/target record, slot 0 (0x8c90); it is
// the single value the approach machine steps toward the far edge as the eagle crosses the grid.
// Field +4 of the enemy/target record (slot 0): the eagle's advancing grid coordinate.
const EAGLE_GRID_POS = ENEMY_TARGET_REC0 + 0x04;
// The coordinate value that means "the eagle has reached the far edge of the grid" -- the terminal
// position at which the sideways sweep is complete and the wave must reset.
const GRID_EDGE = 0xd0;

export function armEagleFinishAtGridEdge(m) {
  const { mem8 } = m;

  // Sample the eagle's current advancing grid coordinate (record slot 0, field +4 == 0x8c94) so the
  // fork below can compare it against the terminal grid-edge value.
  const pos = mem8[EAGLE_GRID_POS];
  // Not yet at the edge: the sweep is still running. Hand the raw coordinate back so the approach
  // machine can keep deriving its grid loop count from it and step the eagle one cell further.
  if (pos < GRID_EDGE) return (m.regs.a = pos); // short of the edge: hand the coordinate back

  // Reached the edge (coordinate >= 0xd0): the eagle has crossed the whole grid. Raise the
  // grid-advance done latch EAGLE_FINISH_FLAG (0x8f3e); this diverts the approach machine out of its
  // stepping path and into the wave's reset.
  mem8[EAGLE_FINISH_FLAG] = 1; // reached the edge: arm the done latch
  // Run the phase-reset epilogue: it drops the aim-indicator flags and the latched enemy X, then
  // advances the eagle wave to its next outer phase now that this sweep is finished.
  advanceEaglePhaseAndClearAim(m); // run the phase-reset epilogue
  // On the finished path the handed-back coordinate is 0, marking that no further stepping is due
  // this frame.
  return (m.regs.a = 0);
}
