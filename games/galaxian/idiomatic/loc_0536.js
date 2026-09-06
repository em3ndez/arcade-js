// SPDX-License-Identifier: GPL-3.0-only
// Fresh-board play-state dispatcher: run the per-frame formation prep (sweep oscillator + occupancy
// summary), then tail-dispatch on SEQUENCE_STATE to one of eight play sub-state handlers. The
// rst-28 inline word table is absorbed into SEQUENCE_HANDLERS below, each handler
// direct-called in place of the dispatch; the dispatch is a tail call (its return is this routine's).
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
import { initPlayfieldState } from "./initPlayfieldState.js";
import { blankScreenRowsThenAdvanceSequence } from "./blankScreenRowsThenAdvanceSequence.js";
import { restoreFormationAndEnterPlaySubstate } from "./restoreFormationAndEnterPlaySubstate.js";
import { advanceSubstateAfterDwellAndQueue } from "./advanceSubstateAfterDwellAndQueue.js";
import { activateObjectsAndBeginPlayPhase } from "./activateObjectsAndBeginPlayPhase.js";
import { runGameplayFrameAndAdvanceOnFieldClear } from "./runGameplayFrameAndAdvanceOnFieldClear.js";
import { stepPlaySubstate6 } from "./stepPlaySubstate6.js";
import { packFlagsToBitmapAndSwitchPlayerState } from "./packFlagsToBitmapAndSwitchPlayerState.js";
import { SEQUENCE_STATE } from "./names.js";

// The eight play sub-state handlers, indexed by SEQUENCE_STATE — one entry per word of the absorbed
// rst-28 jump table at {,,,,,,,}.
const SEQUENCE_HANDLERS = [
  initPlayfieldState, // 0
  blankScreenRowsThenAdvanceSequence, // 1
  restoreFormationAndEnterPlaySubstate, // 2
  advanceSubstateAfterDwellAndQueue, // 3
  activateObjectsAndBeginPlayPhase, // 4
  runGameplayFrameAndAdvanceOnFieldClear, // 5
  stepPlaySubstate6, // 6
  packFlagsToBitmapAndSwitchPlayerState, // 7
];

export function loc_0536(m) {
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  return SEQUENCE_HANDLERS[m.mem8[SEQUENCE_STATE]](m);
}
