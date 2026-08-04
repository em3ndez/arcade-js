// SPDX-License-Identifier: GPL-3.0-only
/**
 * submitHighScoresAndReset — game-over teardown: offer each finishing player's final
 *   score to the "BEST SCORES TODAY" table (entering initials if it places), then reset
 *   the game state and hand off to the attract/entry handler.  ROM 0x0371.
 *
 * Reached by a jump when a game ends (the death/continue sequencer runs out of players),
 * so it first drops the caller's stale return frame and restarts from a clean stack. Then:
 *
 *   1. Play the game-over jingle.
 *   2. For a real 1- or 2-player game (the player-count byte is 1 or 2), finish each
 *      active player's score: wipe and rebuild the board display, hold briefly, then for
 *      each player in turn select that player and offer their saved score to the high-score
 *      table. If a score places, run the initials-entry screen for the rank it landed at.
 *      Player 1 always finishes; player 2 also finishes in a two-player game.
 *   3. Reset for what comes next: clear the player-count byte, re-arm the secondary state
 *      byte, re-read the DIP switches, and paint the round-setup screen.
 *   4. Hand off to the reset/entry handler, which takes the game back to attract.
 *
 * Which player is being finished is published in the secondary state byte before each
 * submit — the high-score submit reads it to pick that player's saved score.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0371.test.js.
 * GATE:     crafted-entry — the game-over path is never dispatched in a boot/attract run
 *           (0 over 4000 frames), so the gate runs it from a real captured sound-request
 *           state with the player-count byte poked over its arms (skip / player 1 / player
 *           2), a once-per-frame tick hook driving the frame waits, and the still-oracle
 *           reset/entry target stubbed identically on both sides. RAM diff outside the dead
 *           top-of-stack scratch (pc/SP/registers excluded per the memory-equivalence
 *           contract). Naturally scored states do not place, so the initials-entry arm is
 *           gated off; the delegate has its own gate (equivalence-4df8).
 * LIVE-OUT: memory-only — the sound ring, the rebuilt board display, the high-score table
 *           and refreshed score readouts, the player-count / secondary-state bytes, and the
 *           painted setup screen; the reset/entry handler owns the eventual return. No
 *           register or flag is read back.
 * NAMES:    GAME_STATE (0x8001, the player-count byte) and ACTIVE_PLAYER (0x8002, the
 *           selected-player / secondary-state byte) from names.js. LANDED_RANK (0x8048) is a
 *           local — the rank the just-submitted score placed at (0 = did not place), the
 *           same cell submitPlayerHighScore records and runHighScoreInitialsEntry consumes;
 *           names.js's tentative VARIANT name is a different round-setup role and would
 *           mislead here.
 */

import { GAME_STATE, ACTIVE_PLAYER, STACK_TOP } from "./names.js";
import { requestSound5 } from "./requestSound5.js";
import { setupBoardDisplay } from "./setupBoardDisplay.js";
import { waitFrames } from "./waitFrames.js";
import { submitPlayerHighScore } from "./submitPlayerHighScore.js";
import { runHighScoreInitialsEntry } from "./runHighScoreInitialsEntry.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { showSetupScreen } from "./showSetupScreen.js";

const LANDED_RANK = 0x8048; // rank the just-submitted score placed at; 0 = it did not place
const GAMEOVER_BOARD_MODE = 0xe0; // board-mode / screen-wide colour byte for the game-over display
const GAMEOVER_HOLD_FRAMES = 20; // video frames the game-over display is held before scoring

// waitFrames, runHighScoreInitialsEntry, and showSetupScreen still model their return
// through the work stack, so each non-tail call is handed the address the oracle would push.
const RESUME_AFTER_WAIT = 0x0389;
const RESUME_AFTER_ENTRY_1 = 0x0398;
const RESUME_AFTER_ENTRY_2 = 0x03ac;
const RESUME_AFTER_SETUP = 0x03bb;

/** Offer the currently-selected player's score to the high-score table; if it placed, run
 *  the initials-entry screen for the rank it landed at. The entry screen holds over many
 *  vblanks, so this is a generator delegated into with `yield*`. */
function* submitScoreAndMaybeEnterInitials(m, resumeAfterEntry) {
  const { mem8 } = m;
  submitPlayerHighScore(m); // records the landed rank in LANDED_RANK (0 if it did not place)
  if (mem8[LANDED_RANK] !== 0) {
    m.push16(resumeAfterEntry);
    yield* runHighScoreInitialsEntry(m);
  }
}

export function* submitHighScoresAndReset(m) {
  const { mem8, regs } = m;

  // State entry reached by a jump: discard the caller's return frame so the reset below
  // starts from a clean stack.
  regs.sp = STACK_TOP;

  requestSound5(m); // game-over jingle

  // Only a real 1- or 2-player game has scores to finish.
  const playerCount = mem8[GAME_STATE];
  if (playerCount === 1 || playerCount === 2) {
    // Rebuild the board display for the game-over screen and hold it a moment.
    setupBoardDisplay(m, GAMEOVER_BOARD_MODE);
    m.push16(RESUME_AFTER_WAIT);
    yield* waitFrames(m, GAMEOVER_HOLD_FRAMES);

    // Player 1 always finishes.
    mem8[ACTIVE_PLAYER] = 1;
    yield* submitScoreAndMaybeEnterInitials(m, RESUME_AFTER_ENTRY_1);

    // A two-player game also finishes player 2.
    mem8[ACTIVE_PLAYER] = playerCount;
    if (playerCount === 2) {
      yield* submitScoreAndMaybeEnterInitials(m, RESUME_AFTER_ENTRY_2);
    }
  }

  // Reset for what comes next: clear the player-count byte, re-arm the secondary state,
  // re-read the DIP switches, and paint the round-setup screen.
  mem8[GAME_STATE] = 0;
  mem8[ACTIVE_PLAYER] = 1;
  applyDipSwitches(m);
  m.push16(RESUME_AFTER_SETUP);
  yield* showSetupScreen(m);

  // Tail hand-off to the reset/entry handler, which owns the eventual return and takes the
  // game back to attract. m.call(0x01f9) returns the rearmMachineAndBranchOnCredits generator
  // (it re-seats the stack and runs the never-returning game loop); we delegate into it.
  return yield* m.call(0x01f9);
}
