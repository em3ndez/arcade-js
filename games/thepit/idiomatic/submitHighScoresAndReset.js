// SPDX-License-Identifier: GPL-3.0-only
/**
 * submitHighScoresAndReset — game-over teardown: offer each finishing player's final score to the
 *   "BEST SCORES TODAY" table (entering initials if it places), reset the game state, then hand off
 *   to the attract/entry handler.
 *
 * Reached by a jump when a game ends. It plays the game-over jingle; for a real 1- or 2-player game (GAME_STATE holds
 * the player count) it finishes each active player's score — rebuild the board display, hold briefly,
 * then select each player via ACTIVE_PLAYER and offer their saved score, running the initials-entry
 * screen if it places (player 1 always, player 2 only in a two-player game). Finally it resets for
 * what comes next (clear the player count, re-arm the selected-player byte, re-read the DIP switches,
 * paint the round-setup screen) and hands off to the reset/entry handler, which returns to attract.
 */

import { rearmMachineAndBranchOnCredits } from "./rearmMachineAndBranchOnCredits.js";
import { GAME_STATE, ACTIVE_PLAYER, VARIANT } from "./names.js";
import { requestSound5 } from "./requestSound5.js";
import { setupBoardDisplay } from "./setupBoardDisplay.js";
import { waitFrames } from "./waitFrames.js";
import { submitPlayerHighScore } from "./submitPlayerHighScore.js";
import { runHighScoreInitialsEntry } from "./runHighScoreInitialsEntry.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { showSetupScreen } from "./showSetupScreen.js";

const LANDED_RANK = VARIANT; // rank the just-submitted score placed at; 0 = it did not place
const GAMEOVER_BOARD_MODE = 0xe0; // board-mode / screen-wide colour byte for the game-over display
const GAMEOVER_HOLD_FRAMES = 20; // video frames the game-over display is held before scoring

/** Offer the currently-selected player's score to the high-score table; if it placed, run the
 *  initials-entry screen (a generator, since it holds over many vblanks) for the rank it landed at. */
function* submitScoreAndMaybeEnterInitials(m) {
  const { mem8 } = m;
  submitPlayerHighScore(m); // records the landed rank in LANDED_RANK (0 if it did not place)
  if (mem8[LANDED_RANK] !== 0) {
    yield* runHighScoreInitialsEntry(m);
  }
}

export function* submitHighScoresAndReset(m) {
  const { mem8 } = m;

  requestSound5(m); // game-over jingle

  // Only a real 1- or 2-player game has scores to finish.
  const playerCount = mem8[GAME_STATE];
  if (playerCount === 1 || playerCount === 2) {
    // Rebuild the board display for the game-over screen and hold it a moment.
    setupBoardDisplay(m, GAMEOVER_BOARD_MODE);
    yield* waitFrames(m, GAMEOVER_HOLD_FRAMES);

    // Player 1 always finishes.
    mem8[ACTIVE_PLAYER] = 1;
    yield* submitScoreAndMaybeEnterInitials(m);

    // A two-player game also finishes player 2.
    mem8[ACTIVE_PLAYER] = playerCount;
    if (playerCount === 2) {
      yield* submitScoreAndMaybeEnterInitials(m);
    }
  }

  // Reset for what comes next: clear player-count, re-arm secondary state, re-read DIPs, paint setup.
  mem8[GAME_STATE] = 0;
  mem8[ACTIVE_PLAYER] = 1;
  applyDipSwitches(m);
  yield* showSetupScreen(m);

  // Tail hand-off to the reset/entry handler (runs the never-returning loop to attract).
  return yield* rearmMachineAndBranchOnCredits(m);
}
