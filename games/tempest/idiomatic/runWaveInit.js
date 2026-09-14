// SPDX-License-Identifier: GPL-3.0-only
import { MODE_DISPATCH_SEL, DEPTH_LO, DEPTH_HI, SPIKE_ACTIVE_FLAG } from "./names.js";
import { reseedStateTables } from "./reseedStateTables.js";
import { seedPerLaneSpikeArray } from "./seedPerLaneSpikeArray.js";
import { resetWorkingRamForStateEntry } from "./resetWorkingRamForStateEntry.js";
import { clearReadyLatchPair } from "./clearReadyLatchPair.js";

// Init sequence: run the four setup subroutines in order, then seed DEPTH_LO and clear
// SPIKE_ACTIVE_FLAG/DEPTH_HI/MODE_DISPATCH_SEL.
export function runWaveInit(m) {
  const { mem8 } = m;

  reseedStateTables(m);
  seedPerLaneSpikeArray(m);
  resetWorkingRamForStateEntry(m);
  clearReadyLatchPair(m);

  mem8[DEPTH_LO] = 250;
  mem8[SPIKE_ACTIVE_FLAG] = 0;
  mem8[DEPTH_HI] = 0;
  mem8[MODE_DISPATCH_SEL] = 0;
}
