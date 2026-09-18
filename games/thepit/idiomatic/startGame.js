// SPDX-License-Identifier: GPL-3.0-only
/**
 * startGame — set up a fresh game once a credit is registered, then enter play.
 * Runs the instant the coin logic banks a credit and picks the starting player/mode: it rebuilds
 * the machine for a brand-new game and falls straight into the main round loop, so it never
 * returns. In order: clear the round-variant selector, arm the interrupt and sound, and blank the
 * screen; request the game-start sound and clear the score and sound queue; decode the dip switches
 * and seed the round state (a dip-derived parameter into MAIN_LOOP_DELAY, LEVEL 1, MEN_LEFT from
 * the dip starting-lives value); prime both players' saved records from those defaults, load the
 * starting player's record, and count the man about to play into the men-left total.
 */

import { VARIANT, LEVEL, GAME_STATE, ACTIVE_PLAYER, MAIN_LOOP_DELAY, LOOP_DELAY_BASE, MEN_LEFT, STARTING_MEN } from "./names.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";
import { enableNmi } from "./enableNmi.js";
import { enableSound } from "./enableSound.js";
import { blankScreen } from "./blankScreen.js";
import { requestSound4 } from "./requestSound4.js";
import { resetScoreAndSoundQueue } from "./resetScoreAndSoundQueue.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { loadPlayerState } from "./loadPlayerState.js";

export function* startGame(m) {
  const { mem8 } = m;

  // Clear the round-variant selector, arm the per-frame interrupt and sound, and blank
  // the whole screen so the first board is built on a clean slate.
  mem8[VARIANT] = 0;
  enableNmi(m);
  enableSound(m);
  blankScreen(m);

  // Play the game-start sound and clear the score plus the sound queue for a fresh game.
  requestSound4(m);
  resetScoreAndSoundQueue(m);

  // Decode the dip switches into this game's difficulty/lives parameters, then seed the
  // round state from them: a dip-derived parameter into its live byte, the starting
  // level of 1, and the men-left count from the dip starting-lives value.
  applyDipSwitches(m);
  mem8[MAIN_LOOP_DELAY] = mem8[LOOP_DELAY_BASE];
  mem8[LEVEL] = 1;
  mem8[MEN_LEFT] = mem8[STARTING_MEN];

  // Prime both players' saved records from these fresh defaults (the selector picks which).
  mem8[ACTIVE_PLAYER] = 1;
  saveActivePlayerRecord(m);
  mem8[ACTIVE_PLAYER] = 2;
  saveActivePlayerRecord(m);

  // Load the starting player's record into the live slot, then count the man into men-left.
  mem8[ACTIVE_PLAYER] = mem8[GAME_STATE];
  loadPlayerState(m);
  mem8[MEN_LEFT] = mem8[MEN_LEFT] + 1;

  // Fall straight into the main round loop; it never returns here.
  return yield* dockManAndDispatchRoundBoundary(m);
}
