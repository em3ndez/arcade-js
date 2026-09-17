// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkRightWhileHeld — the shared setup of Mario's ground-movement dispatch plus
 * its RIGHT arm. Reads the horizontal position gate's two-flag verdict and the
 * cooked control word P1_INPUT once (both consumed by every downstream arm), then
 * walks right when the right-limit flag is clear AND Right (bit 0) is held;
 * otherwise stages the control word in A and hands off to the LEFT arm. Movement
 * priority is fixed: right beats left beats climb.
 *
 * LIVE-OUT: memory-only; the accumulator carries the control word into the LEFT arm.
 */

import { P1_INPUT } from "./names.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js";
import { walkMarioRight } from "./walkMarioRight.js";
import { walkLeftWhileHeld } from "./walkLeftWhileHeld.js";

const CONTROL_RIGHT = 0x01;
const AT_RIGHT_LIMIT = 1;

export function walkRightWhileHeld(m) {
  const { regs, mem8 } = m;

  const positionGate = limitMarioHorizontalTravel(m);
  const control = mem8[P1_INPUT];

  if (positionGate.e !== AT_RIGHT_LIMIT && (control & CONTROL_RIGHT) !== 0) {
    return walkMarioRight(m);
  }

  // The LEFT arm reads both inputs from the register file, as the fall-through delivered them.
  regs.a = control;
  return walkLeftWhileHeld(m);
}
