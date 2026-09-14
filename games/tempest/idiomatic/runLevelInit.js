// SPDX-License-Identifier: GPL-3.0-only
import { seedFrameControlTimers } from "./seedFrameControlTimers.js";
import { reseedStateTables } from "./reseedStateTables.js";
import { resetWorkingRamForStateEntry } from "./resetWorkingRamForStateEntry.js";

/**
 * runLevelInit -- level-entry initialization sequencer. ROM 0x9025.
 *
 * Role in the machine: run each time the game enters a level to bring the working state into a known
 * starting configuration. It owns no logic of its own -- it is the ordered spine that fires the three
 * initialization stages so a fresh board starts with its timers armed, its state tables reseeded, and its
 * working RAM cleared before the main frame loop takes over.
 *
 * Behavior: three calls, strictly in order. First seedFrameControlTimers ($921b) primes the per-frame
 * control/pacing timers. Then reseedStateTables ($92c5) walks the ROM record tables and rebuilds the game
 * state (enemy tables, sizing, level-scaled seeds). Finally it tail-delegates to resetWorkingRamForStateEntry,
 * returning that routine's result directly -- the main-init pass that clears working RAM for state entry.
 * The routine performs no memory write of its own; all effects live in the three callees.
 *
 * Live-out: nothing written directly here; the composed state left by the three stages (armed timers,
 * reseeded tables, cleared working RAM) is the effect. Grounding: [seen].
 */
export function runLevelInit(m) {
  seedFrameControlTimers(m);                  // stage 1: arm the per-frame control/pacing timers
  reseedStateTables(m);                       // stage 2: rebuild game state from the ROM record tables
  return resetWorkingRamForStateEntry(m);     // stage 3 (tail): clear working RAM, return its result
}
