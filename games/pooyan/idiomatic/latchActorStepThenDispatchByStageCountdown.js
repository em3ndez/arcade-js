// SPDX-License-Identifier: GPL-3.0-only
import { STAGE_COUNTDOWN } from "./names.js";
import { restartActorAnimUnlessPhaseAdvanced } from "./restartActorAnimUnlessPhaseAdvanced.js";
import { dispatchActorSpawnBySubStateAndPaceCadence } from "./dispatchActorSpawnBySubStateAndPaceCadence.js";
/**
 * latchActorStepThenDispatchByStageCountdown — stash the actor's step value, then branch on the stage countdown.
 *
 * Writes the value into the record at rec+5 and latches it — it becomes the count the
 * timer-dispatch path reads. If the stage countdown is below three, control tails into the
 * state-timer dispatch (which reads the latch); otherwise it tails into the spawn/queue gate.
 * Both exits return the delegate's result directly.
 */
export function latchActorStepThenDispatchByStageCountdown(m, rec = m.regs.ix, value = m.regs.a) {
  const { mem8 } = m;
  mem8[rec + 0x05] = value; // stash + latch the step value
  if (mem8[STAGE_COUNTDOWN] < 0x03) return dispatchActorSpawnBySubStateAndPaceCadence(m, rec, value); // timer-dispatch path
  return restartActorAnimUnlessPhaseAdvanced(m, rec); // spawn/queue gate
}
