// SPDX-License-Identifier: GPL-3.0-only
// Top-level game-state handler (the restore-saved-board play-state dispatcher; sibling of, which
// differs at sub-states 2/6/7). Runs the per-frame formation prep (sweep oscillator + occupancy summary),
// then tail-dispatches on the sequence-state selector to one of eight play sub-state handlers.

// The pushes the inline word table base and rst-28s into it; unlike it pushes
// NO continuation first, so the selected handler's own return goes straight to 's caller -- a pure
// tail dispatch. The idiomatic form ABSORBS the rst-28 computed jump into a JS switch that calls the named
// handler for each index directly, so the m.call and its inline word table dissolve.

// The selector holds 0..7 in this game state (all eight table slots are real handlers); an out-of-range
// value cannot occur here (the would jp past the eight-entry table into code bytes), so the switch has
// no default arm and no arm can throw.
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
import { initPlayfieldState } from "./initPlayfieldState.js";
import { blankScreenRowsThenAdvanceSequence } from "./blankScreenRowsThenAdvanceSequence.js";
import { restoreSavedStateAndEnterPlaySubstate } from "./restoreSavedStateAndEnterPlaySubstate.js";
import { advanceSubstateAfterDwellAndQueue } from "./advanceSubstateAfterDwellAndQueue.js";
import { activateObjectsAndBeginPlayPhase } from "./activateObjectsAndBeginPlayPhase.js";
import { runGameplayFrameAndAdvanceOnFieldClear } from "./runGameplayFrameAndAdvanceOnFieldClear.js";
import { stepAltPlaySubstate6 } from "./stepAltPlaySubstate6.js";
import { saveFlagsToSnapshotAndSwitchPlayerState } from "./saveFlagsToSnapshotAndSwitchPlayerState.js";
import { SEQUENCE_STATE } from "./names.js";

export function loc_077b(m) {
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  switch (m.mem8[SEQUENCE_STATE]) {
    case 0:
      return initPlayfieldState(m);
    case 1:
      return blankScreenRowsThenAdvanceSequence(m);
    case 2:
      return restoreSavedStateAndEnterPlaySubstate(m);
    case 3:
      return advanceSubstateAfterDwellAndQueue(m);
    case 4:
      return activateObjectsAndBeginPlayPhase(m);
    case 5:
      return runGameplayFrameAndAdvanceOnFieldClear(m);
    case 6:
      return stepAltPlaySubstate6(m);
    case 7:
      return saveFlagsToSnapshotAndSwitchPlayerState(m);
  }
}
