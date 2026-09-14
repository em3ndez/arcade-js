// SPDX-License-Identifier: GPL-3.0-only
import { seedFrameControlTimers } from "./seedFrameControlTimers.js";
import { reseedStateTables } from "./reseedStateTables.js";
import { resetWorkingRamForStateEntry } from "./resetWorkingRamForStateEntry.js";

// Startup init: run the two seed routines in order, then tail-delegate to the main init.
export function runLevelInit(m) {
  seedFrameControlTimers(m);
  reseedStateTables(m);
  return resetWorkingRamForStateEntry(m);
}
