// SPDX-License-Identifier: GPL-3.0-only
/**
 * runPlayerTwoPlayFrame — the game-state-4 (second player) play handler.
 *
 * WHAT IT IS
 *   The top-level handler for game-state 4, player 2's turn, and the sibling of runPlayerOnePlayFrame. Each
 *   frame it runs the shared formation prep, then tail-dispatches on SEQUENCE_STATE (0x400a) to one of eight
 *   play sub-state handlers. It differs from player 1 only at sub-states 2, 6 and 7 — the ones that restore
 *   and save through SAVED_STATE_SNAPSHOT (0x41a0) instead of PACKED_FLAG_BITMAP (0x4180).
 *
 * ROLE IN THE MACHINE
 *   ROM 0x077b. Its terminal (index 7) saves this board into SAVED_STATE_SNAPSHOT (0x41a0), sets
 *   CURRENT_PLAYER=0 and hands back to game-state 3 (player 1). The idiomatic form ABSORBS the ROM's rst-28
 *   computed jump into this switch, each named handler direct-called in place of the dispatch. The Z80
 *   pushes NO continuation first, so each handler's own return goes straight to the caller — a pure tail
 *   dispatch. SEQUENCE_STATE holds 0..7 here (all eight table slots are real handlers); an out-of-range
 *   value cannot occur (it would jp past the eight-entry table into code bytes), so the switch has no
 *   default arm.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory/VRAM/hardware only (whatever the selected sub-handler touches); no register result the
 * caller reads.
 */
// Per-frame formation prep, run before the dispatch (formation sweep oscillator + row/column occupancy).
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
// Sub-state 0 (shared): init the playfield — clear lamps, zero-fill work RAM, arm the dwell.
import { initPlayfieldState } from "./initPlayfieldState.js";
// Sub-state 1 (shared): progressive screen clear, 32 VRAM cells per frame.
import { blankScreenRowsThenAdvanceSequence } from "./blankScreenRowsThenAdvanceSequence.js";
// Sub-state 2 (player-2 variant): expand the saved snapshot (SAVED_STATE_SNAPSHOT 0x41a0) into the flag
// grid, mirror the flip flag, arm the 150-tick dwell, and cue the intro sound.
import { restoreSavedStateAndEnterPlaySubstate } from "./restoreSavedStateAndEnterPlaySubstate.js";
// Sub-state 3 (shared): dwell timer — on zero-cross reload it and enqueue this state's command word.
import { advanceSubstateAfterDwellAndQueue } from "./advanceSubstateAfterDwellAndQueue.js";
// Sub-state 4 (shared): begin play — set OBJ_ACTIVE_FLAG (0x4200)=1 and seed the play subsystem.
import { activateObjectsAndBeginPlayPhase } from "./activateObjectsAndBeginPlayPhase.js";
// Sub-state 5 (shared): the per-frame gameplay pipeline.
import { runGameplayFrameAndAdvanceOnFieldClear } from "./runGameplayFrameAndAdvanceOnFieldClear.js";
// Sub-state 6 (player-2 variant): the alternate sub-state-6 step, keyed on advance gate 0x4195.
import { stepAltPlaySubstate6 } from "./stepAltPlaySubstate6.js";
// Sub-state 7 (player-2 variant): terminal — pack into SAVED_STATE_SNAPSHOT, CURRENT_PLAYER=0, GAME_STATE=3.
import { saveFlagsToSnapshotAndSwitchPlayerState } from "./saveFlagsToSnapshotAndSwitchPlayerState.js";
import { SEQUENCE_STATE } from "./names.js";

export function runPlayerTwoPlayFrame(m) {
  // Shared per-frame formation prep, run for every sub-state.
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  // Tail-dispatch on the current sequence step; the handler's return is this routine's return.
  switch (m.mem8[SEQUENCE_STATE]) {
    case 0:
      return initPlayfieldState(m);
    case 1:
      return blankScreenRowsThenAdvanceSequence(m);
    case 2:
      // Player-2 board start: restore from the saved snapshot rather than the packed bitmap.
      return restoreSavedStateAndEnterPlaySubstate(m);
    case 3:
      return advanceSubstateAfterDwellAndQueue(m);
    case 4:
      return activateObjectsAndBeginPlayPhase(m);
    case 5:
      return runGameplayFrameAndAdvanceOnFieldClear(m);
    case 6:
      // Player-2 sub-state-6 mirror (advance gate 0x4195 rather than player 1's path).
      return stepAltPlaySubstate6(m);
    case 7:
      // Player-2 terminal: save this board to SAVED_STATE_SNAPSHOT and hand back to game-state 3.
      return saveFlagsToSnapshotAndSwitchPlayerState(m);
  }
}
