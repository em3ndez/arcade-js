// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextLevel — clear the current level and set up the next one (the "finished the level"
 * outcome of the per-frame round-boundary gate; the lost-life outcome goes elsewhere).
 *
 * It bumps the LEVEL counter — the single place a cleared level is counted, read by every
 * difficulty subsystem — persists the player's progress into their backup, rebuilds the whole
 * screen, shows and holds the between-levels bonus screen (which adds to the score), persists
 * again, then falls into the round (re)init that seats the next level. One guard first: with no
 * live game in progress (GAME_STATE = attract / game over) there is nothing to advance, so it hands
 * to the reset epilogue instead.
 */

import { initRoundAndEnterMainLoop } from "./initRoundAndEnterMainLoop.js";
import { GAME_STATE, LEVEL } from "./names.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { setupBoardDisplay } from "./setupBoardDisplay.js";
import { showBonusScreen } from "./showBonusScreen.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";

// The board-mode byte setupBoardDisplay records and reuses as the screen-wide fill colour.
const NEXT_LEVEL_BOARD_MODE = 160;

export function* advanceToNextLevel(m) {
  const { mem8 } = m;

  // No live game (attract / game over) → nothing to advance; hand off to the reset epilogue.
  if (mem8[GAME_STATE] >= 3) return yield* resetStateAndShowSetup(m);

  // Count this level cleared.
  mem8[LEVEL] = mem8[LEVEL] + 1;

  saveActivePlayerRecord(m);

  // Rebuild the screen, then show/hold the between-levels bonus screen (a generator that also tallies score).
  setupBoardDisplay(m, NEXT_LEVEL_BOARD_MODE);
  yield* showBonusScreen(m);

  saveActivePlayerRecord(m);

  // Fall into the round (re)init that seats the next level; m.call returns its generator, so yield*.
  return yield* initRoundAndEnterMainLoop(m);
}
