// SPDX-License-Identifier: GPL-3.0-only
// mainLoop -- born-live generator spine. Pooyan's main loop free-runs with no vblank wait, so the
// frame boundary is synthetic: it is the per-frame WORKER (ring-idle) iteration, NOT every iteration.
// The real machine drains the whole display command ring per vblank; the engine must too, or a ring
// backlog (built during the credit screen) drains one command per NMI and leaves stale attract tiles
// on the playfield. So run mainLoopStep repeatedly, draining command dispatches WITHIN the frame, and
// yield only when it reports the worker ran -- there the engine fires the vblank NMI and resumes.
import { mainLoopStep } from "../translated/mainLoopStep.js";

export function* mainLoop(m) {
  for (;;) {
    if (mainLoopStep(m)) yield;
  }
}
