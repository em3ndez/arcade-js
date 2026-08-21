// SPDX-License-Identifier: GPL-3.0-only
// mainLoop -- born-live generator spine. Pooyan's main loop free-runs with no vblank wait, so the
// frame boundary is synthetic: yield once per iteration at the loop top, where the engine fires the
// vblank NMI and then resumes. One iteration of the state driver is mainLoopStep; the boot chain
// reaches this generator through its tail call into the main loop.
import { mainLoopStep } from "../translated/mainLoopStep.js";

export function* mainLoop(m) {
  for (;;) {
    yield;
    mainLoopStep(m);
  }
}
