// SPDX-License-Identifier: GPL-3.0-only
import { ENEMY_TARGET_REC0, EAGLE_FINISH_FLAG } from "./names.js";
import { advanceEaglePhaseAndClearAim } from "./advanceEaglePhaseAndClearAim.js";
/**
 * Eagle grid-advance guard. Reads the eagle's advancing grid coordinate; while it is short of the
 * grid edge the guard just hands that coordinate back so the approach machine keeps stepping. Once
 * the coordinate reaches the edge it arms the grid-advance done latch and runs the phase-reset
 * epilogue, which zeroes the handed-back value.
 *
 * LIVE-OUT: A — the coordinate on the short-of-edge path (the approach machine derives its grid loop
 * count from it), or 0 after the reset; set through the return bridge so the translated caller reads
 * it back out of the register.
 */
// Field +4 of the enemy/target record (slot 0): the eagle's advancing grid coordinate.
const EAGLE_GRID_POS = ENEMY_TARGET_REC0 + 0x04;
const GRID_EDGE = 0xd0;

export function armEagleFinishAtGridEdge(m) {
  const { mem8 } = m;

  const pos = mem8[EAGLE_GRID_POS];
  if (pos < GRID_EDGE) return (m.regs.a = pos); // short of the edge: hand the coordinate back

  mem8[EAGLE_FINISH_FLAG] = 1; // reached the edge: arm the done latch
  advanceEaglePhaseAndClearAim(m); // run the phase-reset epilogue
  return (m.regs.a = 0);
}
