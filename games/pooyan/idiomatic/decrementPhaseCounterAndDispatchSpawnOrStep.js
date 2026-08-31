// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { spawnSpecialActorElseStep } from "./spawnSpecialActorElseStep.js";
import { advanceEagleStageTimersAndLatchMoveElseRearm } from "./advanceEagleStageTimersAndLatchMoveElseRearm.js";
/**
 * decrementPhaseCounterAndDispatchSpawnOrStep — the head of the special-actor (eagle-stage)
 * sub-state machine: decrement the phase counter, then pick one of two branches.
 *
 * WHAT IT IS
 *   The two-instruction entry point of the special-actor stepper. Register B carries a phase
 *   counter that counts down toward the frame on which a new special actor is due. Every visit
 *   decrements that counter exactly once and routes on the result: the single entry value 1
 *   (which the decrement drives to 0) means "the countdown has elapsed -- act on the actor";
 *   any other value means "still counting -- just advance the animation".
 *
 * ROLE IN THE MACHINE
 *   This head sits above two workers and does nothing but choose between them:
 *     - spawnSpecialActorElseStep — the "spawn next" branch: brings the singleton special
 *       actor into being if it does not yet exist, or steps it if it already does.
 *     - advanceEagleStageTimersAndLatchMoveElseRearm — the "animation-advance" branch: the
 *       eagle-stage stepper that drains the three stage timers and latches the actor's move
 *       direction and speed into its record, re-arming the timers when they run out.
 *   That stepper re-enters this head with the counter forced to 0xff once it has re-armed; the
 *   decrement takes 0xff to 0xfe (non-zero), so a re-entry always lands back on the stepper
 *   branch and can never spuriously reach the spawn side.
 *
 * ROM 0x57c3.
 * Grounding: [seen].
 *
 * LIVE-OUT: the decremented phase counter, left in the B register — a worker that returns
 * without rewriting B leaves this value in place for the next visit to read. The return value
 * is whatever the chosen worker returns. Both branches are tail hand-offs (a jump that reuses
 * the caller's frame), so this routine itself leaves nothing else behind.
 */
export function decrementPhaseCounterAndDispatchSpawnOrStep(m, count = m.regs.b, rec = m.regs.ix) {
  // Decrement the phase counter as an 8-bit value -- this is the `dec b` at ROM 0x57c3, with
  // `count` being the B register at entry. `rec` is the special-actor record pointer (the IX
  // register); both branches carry it through untouched to whichever worker runs.
  const next = u8(count - 1);
  // Counter reached 0: the countdown has elapsed. Write the counter back as 0 and hand off to
  // the spawn-or-step entry, which spawns the singleton special actor (or steps it if it is
  // already live). This is the b==1 case -- the only entry value that reaches the spawn side.
  if (next === 0) return (m.regs.b = 0, spawnSpecialActorElseStep(m, rec)); // counter reached 0 -> spawn-or-step entry
  // Still counting: store the decremented count back into B and hand off to the eagle-stage
  // stepper, which drains the stage timers and latches the actor's move direction+speed. B
  // carries the live count forward so the countdown resumes from here on the next visit.
  return (m.regs.b = next, advanceEagleStageTimersAndLatchMoveElseRearm(m, rec)); //            otherwise -> animation-advance stepper
}
