// SPDX-License-Identifier: GPL-3.0-only
/**
 * runDeathAnimationSubstate — the sub-state that plays Mario's DEATH ANIMATION: service the
 * effect-sprite state machine, then run the death-animation phase dispatch.
 *
 * It sits in BOTH sub-state tables. In the attract table it is the death the attract demo
 * ends on — the demo kills its own Mario. In the credited-game table it is the sub-state
 * gameplay hands over to on the frame Mario dies, and it hands on in turn to the two
 * life-loss handlers. A single episode runs a fixed 296 frames; a credited one-player game
 * plays three of them, a two-player game six.
 *
 * It does exactly two things, back to back, and nothing of its own:
 *
 *   1. Service the effect-sprite state machine — route EFFECT_STATE to its per-state handler
 *      (idle / arm / countdown).
 *   2. Run the death-animation dispatch — vector DEATH_ANIM_PHASE through its jump table to
 *      the current phase's handler (seed / step / hand-off).
 *
 * The second step is a TAIL dispatch: its handler's own return returns past this routine, so
 * its result is propagated unchanged. Nothing currently reads that value.
 *
 * Neither callee takes a register input — each reads its selector straight from RAM — so
 * there is nothing to marshal; both are direct calls.
 *
 * WHAT THE NAME DOES NOT CLAIM.
 *   (a) Not a cause. It does NOT claim "runs when something kills Mario": the
 *       bonus-timer-expiry death reaches the same sequence with MARIO_ACTIVE still set,
 *       entering it past the MARIO_ACTIVE test entirely. The name is by EFFECT, not trigger.
 *   (b) It does not decrement the life count. That happens in the NEXT sub-state, which the
 *       phase dispatch's hand-off arm reaches.
 *   (c) It makes no pixel claim. What was observed of the animation is RAM and instruction
 *       fetches — a 296-frame sequence of four cycling (code, attribute) sprite pairs
 *       settling on one tile — not a description of what a player sees.
 *   (d) It does not claim the effect-sprite service in step 1 belongs to the death animation.
 *       That is a separate machine this sub-state also happens to drive.
 *
 * LIVE-OUT: memory-only, and none of it written here — the effect cluster, the
 * death-animation cells, the sprite record and the sub-state are all written by the two
 * callees. The second callee's return value is forwarded unchanged.
 */

import { dispatchEffectState } from "./dispatchEffectState.js"; // effect-sprite state-machine router
import { dispatchDeathAnimationPhase } from "./dispatchDeathAnimationPhase.js"; // death-animation phase dispatch

export function runDeathAnimationSubstate(m) {
  // Service the effect-sprite state machine for this frame.
  dispatchEffectState(m);

  // Then the death-animation dispatch. It is a tail dispatch, so its handler's own return
  // returns on this routine's behalf; propagate its value unchanged.
  return dispatchDeathAnimationPhase(m);
}
