// SPDX-License-Identifier: GPL-3.0-only
/**
 * rearmMachineAndBranchOnCredits — the boot/restart state entry: re-arm the machine, then fork
 * on the credit count to either the held credit screen or into play.
 *
 * Reached by a jump from the reset epilogue (and the game-over teardown), so it is a state
 * ENTRY, not a called subroutine, and never returns. It re-arms the machine — enables the
 * per-frame interrupt, arms ACTIVE_PLAYER (the
 * secondary game-state byte the DIP decode folds into its flip-screen configuration), commits
 * the cabinet DIP settings — then forks on CREDIT_COUNT: credits present hands off to the held
 * credit screen, which spins forever; no credits (the normal path) mutes the audio, clears
 * GAME_STATE, holds the fixed screen for a beat, then enters play. Both exits never return, and
 * the held-screen mode's role in the attract cycle is not pinned, so the name stays neutral.
 */

import { showCreditScreen } from "./showCreditScreen.js";
import { enableNmi } from "./enableNmi.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { disableSound } from "./disableSound.js";
import { showFixedScreen } from "./showFixedScreen.js";
import { enterPlayMode } from "./enterPlayMode.js";
import { GAME_STATE, ACTIVE_PLAYER, CREDIT_COUNT } from "./names.js";

export function* rearmMachineAndBranchOnCredits(m) {
  const { mem8 } = m;

  // Re-arm: enable the per-frame interrupt and arm the secondary game-state byte for the DIP decode.
  enableNmi(m);
  mem8[ACTIVE_PLAYER] = 1;
  applyDipSwitches(m);

  if (mem8[CREDIT_COUNT] !== 0) {
    // Credits present: hand off to the held credit screen, which spins on it forever.
    return yield* showCreditScreen(m);
  }

  // Normal path: mute the audio, clear the game-mode byte (play overwrites it straight after),
  // hold the fixed screen for a beat, then enter play.
  disableSound(m);
  mem8[GAME_STATE] = 0;
  yield* showFixedScreen(m);
  return yield* enterPlayMode(m);
}
