// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { latchColumnLimitAndArmTurnAnimation } from "./latchColumnLimitAndArmTurnAnimation.js";
import { clearColumnLimitAndArmTurnAnimation } from "./clearColumnLimitAndArmTurnAnimation.js";
/**
 * countdownThenRearmTurnAnimationByFlag — one state of a moving actor's per-record state machine.
 *
 * WHAT IT IS
 *   Every arena actor (an enemy/object record) carries a small state machine of its own: a state
 *   index at record offset +0x02 selects, each frame, which handler runs for that record. This is
 *   one of those handlers. While the record sits in this state the actor plays out its current
 *   animation and simply waits; when its phase timer runs out the record steps to the neighbouring
 *   state and its turn-around animation is re-armed for the next leg of movement.
 *
 * ROLE IN THE MACHINE
 *   A "turn" here is the actor reversing direction at a column threshold: as it walks it counts down
 *   toward a tile-column limit, and when that limit is crossed a dedicated turn animation plays.
 *   This handler is the timed hinge between two such legs — hold the actor for a fixed number of
 *   frames, then advance its state and load the correct turn animation so the next leg begins with
 *   the right script and the right column limit.
 *
 * ROM ADDRESS: 0x4350.
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only. Everything this handler produces lands in the actor's record (its
 *   animation cursor, its phase timer, its state index, and — via the two arm routines — its
 *   turn-column limit and animation-script pointer). The scratch registers it leaves behind
 *   (the accumulator and the condition flags) are not read by the state dispatch that called it.
 */

// Record-field offsets this handler touches, all measured from the record base (IX).
const PHASE_TIMER = 0x11; //     +0x11: per-record down-counter pacing how long this state lasts
const STATE_FIELD = 0x02; //     +0x02: state index selecting the actor's handler; stepped on lapse
const VARIANT_FLAG = 0x08; //    +0x08: flag byte whose bit0 picks which turn animation to re-arm
const BIT0 = 0x01; //            mask for that selector bit

export function countdownThenRearmTurnAnimationByFlag(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — tick the actor's animation sequencer.
  // advanceObjectAnimationFrame walks this record's own animation script: it counts down the
  // frame-hold at +0x0e and, only when a frame lapses, pulls the next tile/attribute/hold triple
  // from the stream pointer at +0x0c/+0x0d. This keeps the sprite animating for every frame the
  // record spends parked in this state.
  advanceObjectAnimationFrame(m, rec);

  // Step 2 — count down the phase timer and, while it is still running, leave the actor in place.
  // The down-counter at +0x11 fixes how long this state holds. Decrement it, and if it has not yet
  // reached zero return immediately: the actor stays in this state for another frame, still
  // animating from Step 1 but not yet advancing its state machine.
  mem8[rec + PHASE_TIMER] = (mem8[rec + PHASE_TIMER] - 1);
  if (mem8[rec + PHASE_TIMER] !== 0) return; // phase timer not yet expired — hold this state

  // Step 3 — the timer has lapsed: step the state machine, then re-arm the turn animation.
  // Stepping the state index at +0x02 moves the record to the adjacent handler in its jump table,
  // so next frame the actor runs its following state. Which turn animation to load for that next
  // leg is chosen by bit0 of the flag byte at +0x08:
  //   bit0 clear (even flag) -> latchColumnLimitAndArmTurnAnimation: latch the turn-column limit
  //                             and point the record at its turn animation script;
  //   bit0 set   (odd flag)  -> clearColumnLimitAndArmTurnAnimation: clear the turn-column limit
  //                             and arm the alternate turn animation script.
  // Both are interior entry points of the shared turn-animation arming routine; each writes the
  // record's column-limit threshold and its animation-script pointer, and is this handler's tail.
  mem8[rec + STATE_FIELD] = (mem8[rec + STATE_FIELD] - 1);
  if ((mem8[rec + VARIANT_FLAG] & BIT0) === 0) return latchColumnLimitAndArmTurnAnimation(m, rec);
  return clearColumnLimitAndArmTurnAnimation(m, rec);
}
