// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { spawnSpecialActorElseStep } from "./spawnSpecialActorElseStep.js";
import { advanceEagleStageTimersAndLatchMoveElseRearm } from "./advanceEagleStageTimersAndLatchMoveElseRearm.js";
/**
 * decrementPhaseCounterAndDispatchSpawnOrStep — the sub-state head: decrement the phase counter and pick a branch.
 *
 * When the counter was 1 (reaches 0) it hands off to the spawn-or-step entry; every other value
 * hands off to the animation-advance stepper. The decremented counter is threaded through the
 * register bridge so a delegate that returns without rewriting it leaves the decremented value behind.
 *
 * SEATING: TAIL-CALL — both exits reuse the caller's frame; the seating is the delegate's.
 * LIVE-OUT: whatever the chosen delegate returns.
 */
export function decrementPhaseCounterAndDispatchSpawnOrStep(m, count = m.regs.b, rec = m.regs.ix) {
  const next = u8(count - 1);
  if (next === 0) return (m.regs.b = 0, spawnSpecialActorElseStep(m, rec)); // counter reached 0 -> spawn-or-step entry
  return (m.regs.b = next, advanceEagleStageTimersAndLatchMoveElseRearm(m, rec)); //            otherwise -> animation-advance stepper
}
