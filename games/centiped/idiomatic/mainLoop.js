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
 * mainLoop — the per-frame foreground loop as a generator.
 *
 * The CPU spins waiting for the frame heartbeat: the 32V interrupt raises $8a's low bit, and the loop's
 * `lsr $8a` consumes it, then it polls the vblank input before running the per-frame subsystem chain.
 * Clock-free, that wait IS the frame boundary — the loop yields there and the engine services the
 * interrupt(s) before resuming. Each frame it kicks the watchdog, then runs the subsystem chain: the
 * wave/board service, the sound engine, the object-spawn dispatcher (which reports whether anything is
 * active — a negative result short-circuits the rest of the frame), and the segment/head/render chain.
 */
export function* mainLoop(m) {
  const { mem8 } = m;
  for (;;) {
    // Vblank sync: wait for the heartbeat bit and the vblank input. The wait is the frame boundary.
    yield;
    mem8[loc_8a] = mem8[loc_8a] >> 1; // consume the interrupt-raised heartbeat bit
    mem8[WATCHDOG] = mem8[IN0];  // kick the watchdog (value is the just-read vblank input; not diffed)

    loc_2561(m);
    updateSoundChannels(m);
    // The spawn spine runs the object work and reports whether the full frame chain still runs this tick:
    // idle slots -> run it; a tick that did spawn/move work -> skip the rest of the frame.
    if (!loc_2741(m)) continue;

    tickEaromWriteback(m);
    loc_2119(m);
    plotObjectCoordinates(m);
    beginCentipedeSegmentSweep(m);
    serviceTimerBank(m);
    loc_2ace(m);
    advanceColumnHeadingState(m);
    stepHeadSegment(m);
    spawnActorOnTimer(m);
    steerHeadAndSeedVelocity(m);
    loc_2059(m);
    advanceDeathRespawnSequence(m);
    scanForRangedCellAndSeed(m);
  }
}
