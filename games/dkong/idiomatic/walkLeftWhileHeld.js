// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkLeftWhileHeld — the LEFT arm of Mario's ground-movement direction dispatch.
 *
 * The movement machine reaches here every frame it has decided Mario is on his feet and has already
 * declined the rightward step. Two things are handed over from the arm above: the frame's cooked
 * control word (bit 0 Right, bit 1 Left, bit 2 Up, bit 3 Down, bit 7 jump press-edge — the byte the
 * input builder publishes in P1_INPUT), and the LEFT half of the horizontal position gate's two-flag
 * verdict, which reads 1 when Mario is standing against a leftward playfield limit. That is not only
 * the far-left screen edge: the same verdict fires for an interior wall at the left end of the top
 * platform on the odd boards, which is why it is a playfield limit rather than a screen edge.
 *
 * So the decision is a two-term gate: walk Mario one frame LEFT only when the player is holding Left
 * AND the position gate has not blocked leftward motion. On every other frame — Left not held, or
 * held but blocked — the frame falls through to the ladder/climb collision handler, which is where
 * the Up and Down directions are serviced. Refusing the walk by falling THROUGH rather than
 * returning is what keeps a refused frame available to the climb path instead of discarding it.
 *
 * MIRROR. The arm immediately above is the same gate for the other direction, and differs in exactly
 * three things: it tests the control word's bit 0 (Right) where this tests bit 1 (Left); it consults
 * the position gate's RIGHT verdict where this consults the LEFT one; and it steps into the
 * rightward walk where this steps into the leftward one. It also does the work this arm INHERITS —
 * it is the arm that calls the position gate and loads the control word, so this routine reads
 * neither itself. Both arms converge on the same fall-through target, so the pair reads as one
 * three-way dispatch: step right, step left, or hand the frame to the climb path.
 *
 * Reads: nothing directly — both inputs arrive in registers from the arm above. Writes: nothing of
 * its own; everything observable is written by the callee it picks.
 * LIVE-OUT: memory-only, plus the return value — which must stay undefined on BOTH arms, because it
 * propagates up the movement cascade where a truthy value would read as a caller-skip.
 */

import { walkMarioLeft } from "./walkMarioLeft.js";
import { armMarioClimbAtLadderEnd } from "./armMarioClimbAtLadderEnd.js"; // the ladder/climb collision handler

// Bit 1 of the cooked control word: the player is holding Left.
// (The mirror arm above tests bit 0, Right.)
const LEFT_HELD = 0x02;

// The horizontal position gate's left verdict reads exactly 1 when leftward motion is
// blocked; every other value leaves the walk open.
const LEFT_BLOCKED = 1;

/**
 * @param {object} m  the machine; both inputs arrive in its register file.
 * @returns {void}
 */
export function walkLeftWhileHeld(m) {
  const { regs } = m;

  // Handed over by the arm above: the left-limit verdict and this frame's control word.
  const leftLimit = regs.d;
  const control = regs.a;

  // Holding Left with room to move: spend the frame on one leftward walk step.
  if (leftLimit !== LEFT_BLOCKED && (control & LEFT_HELD) !== 0) {
    return walkMarioLeft(m);
  }

  // Otherwise the frame belongs to the ladder/climb collision handler.
  return armMarioClimbAtLadderEnd(m);
}
