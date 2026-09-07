// SPDX-License-Identifier: GPL-3.0-only
/**
 * runPlayerOnePlayFrame — the game-state-3 (first/active player) play handler.
 *
 * WHAT IT IS
 *   The top-level handler for game-state 3, player 1's turn. Each frame it runs the shared formation prep
 *   (sweep oscillator + occupancy summary), then tail-dispatches on the sequence-state selector
 *   SEQUENCE_STATE (0x400a) to one of eight play sub-state handlers.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x0536. The eight sub-states carry a board from init through the playable frame to its terminal:
 *   its terminal (index 7) saves this board into PACKED_FLAG_BITMAP (0x4180), sets CURRENT_PLAYER=1 and
 *   hands off to game-state 4 (runPlayerTwoPlayFrame). The idiomatic form ABSORBS the ROM's rst-28 computed
 *   jump into the SEQUENCE_HANDLERS table below — each handler direct-called in place of the dispatch. The
 *   Z80 pushes NO continuation before the jump, so the selected handler's own return is this routine's
 *   return: a pure tail dispatch. SEQUENCE_STATE holds 0..7 here (all eight table slots are real handlers),
 *   so no default arm is needed.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory/VRAM/hardware only (whatever the selected sub-handler touches); no register result the
 * caller reads.
 */
// Per-frame formation prep, run before the dispatch (formation sweep oscillator + row/column occupancy).
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
// rst-28 jump table. Each full-line note below states what that sub-state does this frame.
const SEQUENCE_HANDLERS = [
  // 0: init the playfield — clear the start lamps, zero-fill the work-RAM spans, arm the dwell, point the
  //    VRAM fill cursor at 0x5000, and advance the sequence.
  initPlayfieldState, // 0
  // 1: progressive screen clear — blank 32 VRAM cells (tile 16) per frame, advancing on the last phase and
  //    reseeding the OBJRAM shadow.
  blankScreenRowsThenAdvanceSequence, // 1
  // 2: board start — unpack this board's saved flag bitmap (PACKED_FLAG_BITMAP 0x4180) into the flag grid,
  //    arm the 150-tick dwell, and cue the board-start sound.
  restoreFormationAndEnterPlaySubstate, // 2
  // 3: dwell timer — tick 0x4009; on its zero-cross reload it to 20, advance the sequence, and enqueue this
  //    state's command word.
  advanceSubstateAfterDwellAndQueue, // 3
  // 4: begin play — on dwell expiry set OBJ_ACTIVE_FLAG (0x4200)=1 to enable the object/AI/projectile
  //    subsystem, seed the player-X reference, and refill the enemy-launch sub-counter block.
  activateObjectsAndBeginPlayPhase, // 4
  // 5: the per-frame gameplay pipeline — the 27 subsystem updates, then the quiescence-gated dwell.
  runGameplayFrameAndAdvanceOnFieldClear, // 5
  // 6: sub-state-6 step — by arm gate/mode flags, advance or redirect the sequence and reload the dwell.
  stepPlaySubstate6, // 6
  // 7: terminal — pack the flag bytes into PACKED_FLAG_BITMAP (0x4180), set CURRENT_PLAYER=1, and hand off
  //    to game-state 4.
  packFlagsToBitmapAndSwitchPlayerState, // 7
];

export function runPlayerOnePlayFrame(m) {
  // Shared per-frame formation prep, run for every sub-state.
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  // Tail-dispatch: the selected handler's return is this routine's return (no pushed continuation).
  return SEQUENCE_HANDLERS[m.mem8[SEQUENCE_STATE]](m);
}
