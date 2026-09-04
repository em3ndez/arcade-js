// SPDX-License-Identifier: GPL-3.0-only
import { initWorkRam } from "./initWorkRam.js";
import { redrawScorePanel } from "./redrawScorePanel.js";
import { enterAttractCycle } from "./enterAttractCycle.js";

// Boot init: seed work RAM from its baked image and paint the initial score panel (both synchronous),
// then return the attract-loop generator the engine drives. Not a generator. The emulated stack pointer
// is left unseated (the idiomatic layer dispatches with JS calls); the harness seats it for the NMI push.
export function bootInit(m) {
  initWorkRam(m);
  redrawScorePanel(m);
  return enterAttractCycle(m);
}
