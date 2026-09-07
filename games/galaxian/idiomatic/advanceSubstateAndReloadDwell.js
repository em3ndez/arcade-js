// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateAndReloadDwell -- step the sequence sub-state and re-arm its dwell timer.
 *
 * WHAT IT IS
 *   A tiny shared "advance and hold" primitive of the sequence state machine: it bumps the sub-state
 *   index at (HL) by one and then reloads the mid-tier dwell timer, so the machine advances a step and
 *   immediately starts a fresh dwell in the new step.
 *
 * ROLE IN THE MACHINE
 *   Both callers pass HL = SEQUENCE_STATE (0x400a), the top-level sequence step index, so in practice this
 *   advances the sequence and holds. It is the "carry on" arm of the state-6 fork advanceDwellOrResetToState1
 *   (0x0722): when the game-over mode flag is clear, that handler calls here to keep the round running.
 *   The re-arm is delegated to reloadSequenceDwellTimer (0x070e), which stamps the dwell-tier timer loc_4009
 *   back to 0x50 (80 frames) -- the middle tier of the dwell cascade the sequence walks on.
 *
 * ROM 0x070d.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the incremented counter at (HL) (SEQUENCE_STATE) and the reloaded dwell timer
 * loc_4009. No register result.
 */
import { reloadSequenceDwellTimer as loc_070e } from "./reloadSequenceDwellTimer.js";

export function advanceSubstateAndReloadDwell(m, counter = m.regs.hl) {
  m.mem8[counter] = m.mem8[counter] + 1; // bump the sub-state counter
  loc_070e(m);                           // re-arm the mode timer
}
