// SPDX-License-Identifier: GPL-3.0-only
import { SEQUENCE_STATE, loc_4009, loc_421d, loc_41b5, loc_400e, loc_4006 } from "./names.js";
import { setSequenceStateByModeAndReloadDwell } from "./setSequenceStateByModeAndReloadDwell.js";
import { advanceSubstateAndReloadDwell } from "./advanceSubstateAndReloadDwell.js";
import { advanceDwellOrResetToState1 } from "./advanceDwellOrResetToState1.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const DWELL_RELOAD = 130; // dwell timer value armed on the inlined tail

/**
 * stepPlaySubstate6 (ROM 0x06d8) -- player-one's play sub-state slot 6, the "branch" step.
 *
 * WHAT IT IS
 *   Dispatched from runPlayerOnePlayFrame (GAME_STATE = 3) at SEQUENCE_STATE index 6, once the play
 *   sub-state (index 5) has cleared the board. It decides how the round continues, keyed on the arm gate
 *   loc_421d (0x421d) and two mode flags: loc_41b5 (0x41b5, the state-advance gate armed to 3 by
 *   armStateAdvanceGate) and loc_400e (0x400e, the paired-player flag). The player-two twin is
 *   stepAltPlaySubstate6.
 *
 * ROLE IN THE MACHINE
 *   See mechanisms.md "The play frames and their sub-states", step 6. The four outcomes are: (gate set,
 *   both flags set) advance the sub-state and reload dwell via advanceSubstateAndReloadDwell; (gate set,
 *   otherwise) redirect the sequence to a fixed step by mode; (gate clear, a flag missing) fall into the
 *   shared dwell/reset tail advanceDwellOrResetToState1 -- the "carry on vs game over" fork; (gate clear,
 *   both flags set) the inlined advance below.
 *
 * Grounding: [seen] (names.js ROUTINES 0x06d8).
 *
 * LIVE-OUT: memory + the command queue. May write SEQUENCE_STATE (0x400a) and dwell loc_4009 (0x4009), or
 *   delegate to one of the three tail routines.
 */
export function stepPlaySubstate6(m) {
  const { mem8 } = m;

  // Arm gate loc_421d (0x421d) set: choose between advancing and redirecting by the two mode flags.
  if (mem8[loc_421d]) {
    // Both flags set -> advance the sub-state counter and re-arm the mid-tier dwell (the delegate handles
    // both). loc_41b5 is the state-advance gate; loc_400e is the paired-player flag.
    if (mem8[loc_41b5] && mem8[loc_400e]) return advanceSubstateAndReloadDwell(m, SEQUENCE_STATE);
    // Otherwise jump SEQUENCE_STATE to a fixed step chosen by mode and reload the dwell.
    return setSequenceStateByModeAndReloadDwell(m, SEQUENCE_STATE);
  }
  // Gate clear and either flag missing -> the shared dwell/reset tail (advance-and-hold, or reset to
  // state 1 / attract when the mode/sound gate loc_4006 bit0 is set).
  if (mem8[loc_41b5] === 0 || mem8[loc_400e] === 0) return advanceDwellOrResetToState1(m, SEQUENCE_STATE);

  // Gate clear but both flags set: inline the advance -- bump the sub-state and arm the 130-tick dwell.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // bump the sub-state counter
  mem8[loc_4009] = DWELL_RELOAD;                   // arm the dwell timer

  // Sound gate: only queue the board-advance audio when the mode/sound gate loc_4006 (0x4006) bit0 is set.
  if ((mem8[loc_4006] & 1) === 0) return; // proceed only when the mode bit is set

  // Queue two channel-6 command words (args 2 then 0) for the deferred sound/display consumer. (The dwell
  // cell loc_4009 is threaded through as enqueueCommandWord's second argument.)
  // enqueue command word 6 with args 2 then 0
  enqueueCommandWord(m, (6 << 8) | 2, loc_4009);
  return enqueueCommandWord(m, 6 << 8, loc_4009);
}
