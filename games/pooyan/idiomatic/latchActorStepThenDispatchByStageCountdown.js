// SPDX-License-Identifier: GPL-3.0-only
import { STAGE_COUNTDOWN } from "./names.js";
import { restartActorAnimUnlessPhaseAdvanced } from "./restartActorAnimUnlessPhaseAdvanced.js";
import { dispatchActorSpawnBySubStateAndPaceCadence } from "./dispatchActorSpawnBySubStateAndPaceCadence.js";
/**
 * latchActorStepThenDispatchByStageCountdown — commit one actor's just-advanced step into its
 * record, then send that actor down one of two update paths depending on how much of the current
 * stage is left to run.  (ROM 0x1410-0x1419)
 *
 * WHAT IT IS
 * ----------
 * Every moving thing in the game -- a hunter riding a rope, a spawned prize, a diving enemy -- is
 * tracked by an ACTOR RECORD: a fixed-layout block of bytes in work RAM. One byte of that record,
 * at offset +5, is the actor's along-track position -- its X / sub-position step. The position
 * handler that runs immediately before this one has already computed the actor's next step value;
 * this routine's first job is simply to WRITE that value home, into rec+5.
 *
 * That write does double duty, which is why the name says "latch". The very same step value is
 * also carried on, unchanged, as the count the spawn-cadence path reads. That path treats the
 * count as a supply budget: at 0x80 or above it considers the supply spent and declines to spawn.
 * So committing the step value here also sets the figure the cadence dispatch will test a moment
 * later -- one value serving as both the actor's stored position and the cadence path's count.
 * That is the latch.
 *
 * With the step committed, the routine looks at how much of the current stage is left and forks.
 * The stage runs on a per-frame down-counter, STAGE_COUNTDOWN (RAM 0x8901), seeded near 0x20 at
 * the top of a stage and draining toward zero as the stage plays out; a value near zero is the
 * cue that the stage is almost over. When fewer than three counts remain, the actor is routed to
 * the spawn-cadence dispatch (which consumes the latched count); while three or more counts
 * remain -- the ordinary body of the stage -- it is routed to the animation-restart gate instead.
 * Each fork is the actor's whole update for the frame, so this routine hands back whatever the
 * chosen path returns.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the back half of one actor's per-frame position/update step. advanceActorPositionByVelocity
 * (ROM 0x13fe) adds the actor's velocity (rec+0x0a) to its position, spends a lap on a wrap past
 * zero, and hands the freshly advanced step value here to be stored and dispatched. The two
 * destinations are dispatchActorSpawnBySubStateAndPaceCadence (ROM 0x1399), the sub-state router
 * that paces child spawning, and restartActorAnimUnlessPhaseAdvanced (ROM 0x141c), the guard that
 * (re)starts an early actor's animation.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only -- the actor's step position at rec+5, plus whatever the dispatched path
 * writes (the spawn-cadence timer and child sprite slot, or the actor's animation fields). The
 * returned value is the forwarded result of the chosen path.
 */
export function latchActorStepThenDispatchByStageCountdown(m, rec = m.regs.ix, value = m.regs.a) {
  const { mem8 } = m;

  // COMMIT + LATCH THE STEP. Write the just-advanced step value home, into the actor record's
  // position field (rec+5). The same value is carried on as `value` into the spawn-cadence path
  // below, where it is read as the running child-supply count -- so the actor's stored position
  // and the cadence path's supply budget are one and the same figure.
  mem8[rec + 0x05] = value; // stash + latch the step value

  // FORK ON HOW MUCH STAGE IS LEFT. Read the per-frame stage down-counter STAGE_COUNTDOWN
  // (RAM 0x8901): seeded near 0x20 when a stage begins and draining toward zero as the stage
  // plays out, so a value below three means the stage is almost spent. In that end-of-stage
  // window, route the actor to the spawn-cadence dispatch, handing it the latched step value as
  // the child-supply count it reads. (ROM 0x1399.)
  if (mem8[STAGE_COUNTDOWN] < 0x03) return dispatchActorSpawnBySubStateAndPaceCadence(m, rec, value); // timer-dispatch path

  // ORDINARY STAGE BODY (three or more counts left on STAGE_COUNTDOWN). Route the actor to the
  // spawn/queue gate, which (re)starts the actor's animation while the actor is still in its
  // early phase and leaves an already-advanced actor untouched. (ROM 0x141c.)
  return restartActorAnimUnlessPhaseAdvanced(m, rec); // spawn/queue gate
}
