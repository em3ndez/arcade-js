// SPDX-License-Identifier: GPL-3.0-only
import { tickActorHoldThenBlankAndClearWaveLatches } from "./tickActorHoldThenBlankAndClearWaveLatches.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { seedEnemyFromDescriptorAndEnterFlight } from "./seedEnemyFromDescriptorAndEnterFlight.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
/**
 * dispatchEnemyActorRecordState — advance one enemy-actor record's state machine by a frame.
 * ROM 0x6f2d. [seen]
 *
 * WHAT IT IS: the per-record state handler for the enemy-actor pool based at
 * ENEMY_ACTOR_TABLE (0x8ae0), whose records are laid out on a 0x18-byte stride. The phase-1
 * driver drivePhase1RecordsThenCheckCompletion walks the fourteen records of that pool and
 * hands each record, in turn, to this routine; the record being worked on is addressed
 * through IX (the `rec` argument). Every enemy — the pooyas that ride the ropes and the
 * objects they launch — carries its own little state machine, and this routine runs exactly
 * one step of it for the one record it is given.
 *
 * ITS ROLE IN THE MACHINE: a router, not a mover. It reads the record's state byte and picks
 * one of three fates for the record this frame — a frame-hold tick, the generic animation
 * mover, or one of two spawn/flight handlers reached through a small dispatch table — then
 * returns straight to the driver, which advances to the next record.
 *
 * The state byte lives at rec+0x02 and is the actor's position in its own state machine:
 *   - state 0x02 tails into the frame-hold tick, which counts a hold field down and, on its
 *     lapse, does the wave/lane bookkeeping before blanking the record's sprite band;
 *   - any state below 0x0b runs the generic animation sequencer for one frame and returns;
 *   - states 0x0b and 0x0c index a two-entry dispatch table (based at 0x6f3e): 0x0b seeds a
 *     fresh object from its descriptor and enters flight, 0x0c is the in-flight mover that
 *     lands it. These are the object state-11 and state-12 handlers; the table is indexed by
 *     the state minus the 0x0b dispatch base, so 0x0b -> entry 0 and 0x0c -> entry 1.
 *
 * LIVE-OUT: memory only. The routine hands nothing back for the driver to read — the driver
 * keeps its own loop counter and record pointer intact across this handler's work and simply
 * steps to the next record. Every effect this handler produces lives in the record's memory.
 */
// The state byte at rec+0x02 selects which handler runs for the record this frame.
const STATE_HOLD_TICK = 0x02; //   state 0x02 tails into the frame-hold tick handler
const DISPATCH_BASE = 0x0b; //     first table-dispatched state; table index = state - 0x0b

export function dispatchEnemyActorRecordState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Read the record's state byte at rec+0x02 — the actor's position in its own state machine
  // and the value every branch below routes on.
  const state = mem8[rec + 0x02];
  // State 0x02: the actor is holding an animation frame. Tail into the frame-hold tick, which
  // advances the animation, counts the +0x11 hold field down, and on its lapse tallies the
  // wave and clears the lane/launch latches before blanking the record's sprite band.
  if (state === STATE_HOLD_TICK) return tickActorHoldThenBlankAndClearWaveLatches(m, rec);
  // States below the 0x0b dispatch base: an ordinary moving/animating enemy. Run the generic
  // animation sequencer for one frame — it either holds the current picture or pulls the next
  // frame from the record's animation script — and return. These states never reach the table.
  if (state < DISPATCH_BASE) { //                     generic animation mover, then return
    advanceObjectAnimationFrame(m, rec);
    return;
  }

  // States 0x0b and up: index the two-entry dispatch table (ROM 0x6f3e) by (state - 0x0b).
  // The subtraction rebases 0x0b -> 0 and 0x0c -> 1; the & 0xff keeps the selector a byte.
  // Only entries 0 and 1 are defined, so any higher state falls through and the record is
  // left untouched this frame.
  switch ((state - DISPATCH_BASE) & 0xff) {
    // Entry 0 (state 0x0b) — object state-11 handler: count the record's frame timer down and,
    // on expiry, seed the object from its 5-byte descriptor (type gated 5..6) and enter flight.
    case 0: return seedEnemyFromDescriptorAndEnterFlight(m, rec); //               state 0x0b -> object state-11 handler
    // Entry 1 (state 0x0c) — object state-12 handler: the in-flight mover that carries a
    // spawned object along its path (waypoint or free) and lands it via the landing animation.
    case 1: return advanceInFlightEnemyAndLand(m, rec); //               state 0x0c -> object state-12 handler
  }
}
