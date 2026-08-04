// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkRightWhileHeld — the shared setup of Mario's on-foot movement dispatch plus its RIGHT arm:
 * walk him right when Right is held and the position gate has not flagged the right-hand limit,
 * otherwise hand the frame on to the left/climb arm.
 *
 * The player-movement state machine reaches here on any frame Mario is neither airborne, nor frozen,
 * nor mid-jump-press — the frame is his to spend on the ground or a ladder. This routine owns the
 * setup the whole ground-movement dispatch shares, then makes the first of its three direction
 * decisions:
 *
 *   1. Ask the horizontal position gate for its two-flag verdict: one flag for the LEFT limit, one
 *      for the RIGHT. Both are 0 when Mario is free to move either way.
 *   2. Read the cooked control word P1_INPUT once, for every arm downstream.
 *   3. Right is honoured only when the right flag says that limit is clear. A right flag of 1 —
 *      Mario at the far-right edge — blocks the rightward step outright, BEFORE the button is even
 *      looked at, so a player leaning on Right at the edge simply gets no step.
 *   4. Clear of the limit AND Right held (control bit 0): spend the frame on one rightward walk step.
 *
 * Everything else — Right blocked, or Right simply not held — falls through to the next arm, which
 * asks the same two questions of the LEFT direction and, failing that, falls into the ladder/climb
 * collision handler. The three arms are one straight-line cascade, so movement priority is fixed:
 * right beats left beats climb.
 *
 * DIFFERENCE FROM ITS MIRROR. The two arms are near-twins in shape — test a verdict flag, test one
 * control bit, tail into a walk routine — but they are NOT peers:
 *   - This arm gates on the RIGHT flag and tests control bit 0; the mirror gates on the LEFT flag and
 *     tests control bit 1.
 *   - This arm performs the shared SETUP the mirror only consumes: it is the one that calls the
 *     position gate and the one that loads P1_INPUT. The mirror recomputes neither — it reads the
 *     verdict and the control word this routine left behind. That makes the mirror a CONTINUATION of
 *     this routine rather than an independent entry, and it is why the hand-off below stages the
 *     control word in the accumulator: the mirror takes both its inputs in the register file, exactly
 *     as the straight-line fall-through delivered them. Promoting them to honest parameters is one
 *     job for the pair together.
 *   - Consequently the BLOCKED path differs in destination: blocked-right lands on the LEFT test,
 *     where movement may still happen, whereas blocked-left lands on the climb handler.
 *
 * Reads: P1_INPUT, plus whatever the position gate reads. Writes: nothing of its own.
 * LIVE-OUT: memory-only, and no meaningful return value — the movement machine tail-returns this
 * routine's result and the cascade above discards it. The one register genuinely live across the
 * hand-off is the accumulator, carrying the control word into the LEFT arm.
 */

import { P1_INPUT } from "./names.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js"; // the horizontal position gate
import { walkMarioRight } from "./walkMarioRight.js"; // one rightward walk step
import { walkLeftWhileHeld } from "./walkLeftWhileHeld.js"; // the LEFT arm this hands off to

const CONTROL_RIGHT = 0x01; // P1_INPUT bit 0 — the Right direction is held
const AT_RIGHT_LIMIT = 1;   // the position gate's right verdict: Mario is at the right-hand limit

export function walkRightWhileHeld(m) {
  const { regs, mem } = m;

  // The verdict pair and the control word are read once here and serve every arm of the cascade.
  const positionGate = limitMarioHorizontalTravel(m); // each verdict is 0 or 1, so an == 1 test is exact
  const control = mem.read8(P1_INPUT);

  // Right: allowed only away from the right-hand limit, and only while the direction is held.
  if (positionGate.e !== AT_RIGHT_LIMIT && (control & CONTROL_RIGHT) !== 0) {
    return walkMarioRight(m);
  }

  // No rightward step this frame — hand it to the leftward arm. Stage the control word where
  // that arm reads it: it takes both its inputs in the register file, exactly as the
  // straight-line fall-through delivered them, because this routine is the one that computed
  // them. So the hand-off is by register rather than by parameter.
  regs.a = control;
  return walkLeftWhileHeld(m);
}
