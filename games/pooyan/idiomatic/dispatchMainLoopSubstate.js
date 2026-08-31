// SPDX-License-Identifier: GPL-3.0-only
import { rearmMainLoopFrame } from "./rearmMainLoopFrame.js";
import { runActivePlayFrame } from "./runActivePlayFrame.js";
import { queueBonusStageTallyDisplayOnDelay } from "./queueBonusStageTallyDisplayOnDelay.js";
import { paintSubstateHudDigitsAndAdvancePhase } from "./paintSubstateHudDigitsAndAdvancePhase.js";
import { driveHunterSpawnDisplayAndAdvancePhase } from "./driveHunterSpawnDisplayAndAdvancePhase.js";
import { advancePlayStateToPhase6OnDwellExpiry } from "./advancePlayStateToPhase6OnDwellExpiry.js";
import { advanceObjectsAndRebuildSprites } from "./advanceObjectsAndRebuildSprites.js";
import { MAINLOOP_SUBSTATE_SELECTOR } from "./names.js";

/**
 * dispatchMainLoopSubstate — the main-loop sub-state dispatcher. Routes on (MAINLOOP_SUBSTATE_SELECTOR & 7) to one of
 * six handlers. States 0 and 1 hand off to their handler and return through it; states 2..5 run the
 * selected handler and then the shared post-handler tail (the four trailing per-frame passes) before
 * returning. Selectors 6 and 7 fall past the six-entry table and throw (guard-slack).
 *
 * LIVE-OUT: memory only — the selected handler's effects (and the tail's, for states 2..5). No
 * register input (no handler reads a register on entry) and no register output.
 */
export function dispatchMainLoopSubstate(m) {
  switch (m.mem8[MAINLOOP_SUBSTATE_SELECTOR] & 7) {
    case 0: return rearmMainLoopFrame(m);
    case 1: return runActivePlayFrame(m);
    case 2: queueBonusStageTallyDisplayOnDelay(m); return advanceObjectsAndRebuildSprites(m);
    case 3: paintSubstateHudDigitsAndAdvancePhase(m); return advanceObjectsAndRebuildSprites(m);
    case 4: driveHunterSpawnDisplayAndAdvancePhase(m); return advanceObjectsAndRebuildSprites(m);
    case 5: advancePlayStateToPhase6OnDwellExpiry(m); return advanceObjectsAndRebuildSprites(m);
    default:
      throw new Error("dispatchMainLoopSubstate: main-loop sub-state selector > 5 (guard-slack)");
  }
}
