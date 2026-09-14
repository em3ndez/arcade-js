// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, IRQ_HEARTBEAT } from "./names.js";
import { resetBothPokeyChips } from "./resetBothPokeyChips.js";
import { dispatchFramePhaseHandler } from "./dispatchFramePhaseHandler.js";
import { seedFramePhaseAndTick } from "./seedFramePhaseAndTick.js";
import { buildFrameVectors } from "./buildFrameVectors.js";

// The main frame loop. After a one-time setup it free-runs forever, pacing itself off the interrupt-driven
// frame counter IRQ_HEARTBEAT (the ~246Hz IRQ increments it): each pass waits until nine interrupts have
// accumulated, clears the counter, and runs the three per-update passes. Expressed as a generator so the
// wait IS the frame boundary — the clock-free engine resumes it once the interrupts it fires bring IRQ_HEARTBEAT
// up to nine, so the busy-wait collapses to a single yield per game update (~26.5Hz). Non-terminating:
// validated by the whole-game boot/convergence, not an isolated equivalence test.
export function* runMainFrameLoop(m) {
  const { mem8 } = m;
  resetBothPokeyChips(m);
  mem8[GAME_MODE] = 0;
  for (;;) {
    while (mem8[IRQ_HEARTBEAT] < 9) yield;
    mem8[IRQ_HEARTBEAT] = 0;
    dispatchFramePhaseHandler(m);
    seedFramePhaseAndTick(m);
    buildFrameVectors(m);
  }
}
