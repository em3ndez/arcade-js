// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_8a, WATCHDOG, IN0,
} from "./names.js";
import { loc_2561 } from "./loc_2561.js";
import { updateSoundChannels } from "./updateSoundChannels.js";
import { loc_2741 } from "./loc_2741.js";
import { tickEaromWriteback } from "./tickEaromWriteback.js";
import { loc_2119 } from "./loc_2119.js";
import { plotObjectCoordinates } from "./plotObjectCoordinates.js";
import { beginCentipedeSegmentSweep } from "./beginCentipedeSegmentSweep.js";
import { serviceTimerBank } from "./serviceTimerBank.js";
import { loc_2ace } from "./loc_2ace.js";
import { advanceColumnHeadingState } from "./advanceColumnHeadingState.js";
import { stepHeadSegment } from "./stepHeadSegment.js";
import { spawnActorOnTimer } from "./spawnActorOnTimer.js";
import { steerHeadAndSeedVelocity } from "./steerHeadAndSeedVelocity.js";
import { loc_2059 } from "./loc_2059.js";
import { advanceDeathRespawnSequence } from "./advanceDeathRespawnSequence.js";
import { scanForRangedCellAndSeed } from "./scanForRangedCellAndSeed.js";

/**
 * mainLoop — the per-frame foreground loop, and the ordering authority for the entire game.
 *
 * Role in the machine: this is the trunk every other subsystem hangs from. The game entry seeds the
 * round and draws the field, then enters this loop as a continuation of itself so the per-frame
 * pauses propagate all the way back out to the host — the entry never returns. Expressed here as a
 * JS generator: the `yield` at the top of each iteration IS the frame boundary, the point where the
 * display's vertical-blank tick lands and the frame's interrupt work gets serviced before we resume.
 * The loop needs no timer of its own — waiting for the heartbeat is the clock.
 *
 * The head of every frame is: block for the heartbeat, consume the heartbeat bit, prove liveness to
 * the watchdog. Then a fixed chain of subsystem dispatches runs in a deliberate order whose sequence
 * encodes the data dependency from bookkeeping through simulation to rendering. The one branch point
 * is the spawn dispatcher `loc_2741`: it does the frame's object-spawn/move work and reports whether
 * the heavy render-and-simulate tail should run this tick — a false answer short-circuits the rest of
 * the frame and loops straight back to the heartbeat wait.
 *
 * Cells: $8a the heartbeat latch (32V interrupt raises its low bit); WATCHDOG ($2000) and IN0 the
 * liveness poke. Grounding: [code] for $8a, [seen] for WATCHDOG/IN0.
 */
export function* mainLoop(m) {
  const { mem8 } = m;
  for (;;) {
    // Vblank sync. The CPU has nothing to compute until the next frame heartbeat, so pause here;
    // this pause is the frame boundary, where the frame interrupt(s) get serviced before we resume.
    yield;

    // Acknowledge the heartbeat we were waiting on: the 32V interrupt raised the low bit of $8a, and
    // a single right-shift consumes it, clearing the "a frame is ready" flag so the next iteration
    // blocks again until the following frame.
    mem8[loc_8a] = mem8[loc_8a] >> 1; // consume the interrupt-raised heartbeat bit

    // Prove liveness to the hardware watchdog. The value written is incidental — it is just the
    // freshly sampled input port and is never compared — what matters is that the write happens every
    // frame, because a watchdog that stops being kicked resets the machine.
    mem8[WATCHDOG] = mem8[IN0];  // kick the watchdog (value is the just-read vblank input; not diffed)

    // Board/wave service, then the sound engine push one frame of work.
    loc_2561(m);
    updateSoundChannels(m);

    // The spine's one branch point: the object/spawn dispatcher does the frame's object work and
    // reports whether the rest of the chain still runs this tick. Idle slots -> run the full tail;
    // a tick that already did spawn/move work -> `continue`, skipping the heavy tail for this frame.
    if (!loc_2741(m)) continue;

    // Past the gate, the full simulate-and-render tail runs in dependency order:
    tickEaromWriteback(m);            // flush deferred non-volatile (EAROM) writes
    loc_2119(m);
    plotObjectCoordinates(m);         // render current object positions
    beginCentipedeSegmentSweep(m);    // open the centipede segment pass
    serviceTimerBank(m);              // age the bank of countdown timers gating periodic events
    loc_2ace(m);                      // advance a movement sub-step accumulator
    advanceColumnHeadingState(m);     // progress the centipede's column/head state
    stepHeadSegment(m);
    spawnActorOnTimer(m);             // release a new actor when its own countdown expires
    steerHeadAndSeedVelocity(m);      // pick the head's heading and lay a fresh velocity seed
    loc_2059(m);                      // continue the object update
    advanceDeathRespawnSequence(m);   // step the death-and-respawn state machine
    scanForRangedCellAndSeed(m);      // walk the playfield cell stream for a cell in range to seed
    // Tail done: loop back to the top and block for the next heartbeat.
  }
}
