// SPDX-License-Identifier: GPL-3.0-only
import { SEQUENCE_STATE, loc_421d, loc_4195, loc_4006, loc_4009 } from "./names.js";
import { setSequenceStateByModeAndReloadDwell } from "./setSequenceStateByModeAndReloadDwell.js";
import { advanceDwellOrResetToState1 } from "./advanceDwellOrResetToState1.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

/**
 * stepAltPlaySubstate6 (ROM 0x07e8) -- player-two's play sub-state slot 6.
 *
 * WHAT IT IS
 *   The GAME_STATE = 4 (player-two / restore-saved-formation) twin of stepPlaySubstate6. Sub-state 6 is
 *   the "branch" step of the play sequence: with the board cleared, decide whether to advance the round,
 *   redirect it to a fixed step, or drop into the shared game-over/carry-on tail. It is keyed on two gate
 *   cells -- the advance gate loc_4195 (0x4195, armed to 3 by armSubstateAdvanceGate) and the show flag
 *   loc_421d (0x421d) -- and mirrors its player-one sibling closely, differing mainly in the dwell reload
 *   it arms on the show arm (80 here vs the shared 130).
 *
 * ROLE IN THE MACHINE
 *   Dispatched from runPlayerTwoPlayFrame at SEQUENCE_STATE index 6 (see mechanisms.md "The play frames
 *   and their sub-states", step 6). It advances/redirects SEQUENCE_STATE and re-arms the dwell timer
 *   loc_4009, and on its default inline advance queues two channel-6 sound command words.
 *
 * Grounding: [seen] (names.js ROUTINES 0x07e8).
 *
 * LIVE-OUT: memory + the command queue. May write SEQUENCE_STATE (0x400a) and dwell loc_4009 (0x4009), or
 *   delegate to setSequenceStateByModeAndReloadDwell / advanceDwellOrResetToState1.
 */
export function stepAltPlaySubstate6(m) {
  const { mem8 } = m;
  // Advance gate loc_4195 (0x4195): nonzero means "advance the sub-state inline this frame"; zero means
  // hand the decision to a delegate (mode-set or the shared dwell/reset tail).
  const advanceArmed = mem8[loc_4195] !== 0; // gate open -> advance the sub-state inline

  // Show-flag arm: loc_421d (0x421d) set selects the "show" branch.
  if (mem8[loc_421d] !== 0) {
    // Gate closed on the show arm: jump SEQUENCE_STATE to a fixed step by mode and reload the dwell.
    if (!advanceArmed) return setSequenceStateByModeAndReloadDwell(m, SEQUENCE_STATE);
    // Gate open: advance the sub-state counter and re-arm the dwell timer loc_4009 to 80 (the shorter
    // show-arm hold, this handler's one divergence from the player-one sibling), then done -- no sound.
    mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
    mem8[loc_4009] = 80;
    return;
  }

  // Show flag clear -> the default arm. Gate closed here drops into the shared dwell/reset tail, the
  // "carry on vs game over" fork (advanceDwellOrResetToState1).
  if (!advanceArmed) return advanceDwellOrResetToState1(m, SEQUENCE_STATE);
  // Gate open on the default arm: advance the sub-state and re-arm the dwell to 130.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4009] = 130;
  // Sound gate: loc_4006 (0x4006) bit0 must be set for the board-advance audio to play; if clear, stop.
  if ((mem8[loc_4006] & 1) === 0) return; // sound-enable bit clear -> no sound
  // Queue two channel-6 sound command words (args 3 then 0) for the deferred sound consumer to voice.
  enqueueCommandWord(m, (6 << 8) | 3);
  return enqueueCommandWord(m, 6 << 8);
}
