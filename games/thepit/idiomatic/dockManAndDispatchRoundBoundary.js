// SPDX-License-Identifier: GPL-3.0-only
/**
 * dockManAndDispatchRoundBoundary — round/state-boundary dispatcher: dock the active player's man
 * count, persist their record, then hand off to next-round setup or end-of-round teardown.
 * Reached at a round boundary. GAME_STATE of 3 or more means no live round, so it hands to the
 * reset epilogue. Otherwise it docks one from MEN_LEFT and saves the whole player record into that
 * player's backup. Mode 1 clears the other player's backup man count and routes by whether men
 * remain (next-round setup vs teardown); mode 2 defers to a phase sequencer. Every exit is a hand-off.
 */

import { GAME_STATE, ACTIVE_PLAYER, MEN_LEFT, PLAYER1_MEN_BACKUP, PLAYER2_MEN_BACKUP } from "./names.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";
import { stepRoundSubPhaseAndBranch } from "./stepRoundSubPhaseAndBranch.js";
import { setUpRoundAndHoldIntro } from "./setUpRoundAndHoldIntro.js";
import { submitHighScoresAndReset } from "./submitHighScoresAndReset.js";

export function* dockManAndDispatchRoundBoundary(m) {
  const { mem8 } = m;

  // No live 1-or-2-player round to wind down: hand straight to the reset epilogue.
  if (mem8[GAME_STATE] >= 3) return yield* resetStateAndShowSetup(m);

  // Dock one man from the active player's working count, then persist their whole record.
  mem8[MEN_LEFT] = mem8[MEN_LEFT] - 1; // working man count (field 1 of the player record)
  saveActivePlayerRecord(m);

  // The second leg (mode 2) runs its own phase sequencer to reach the destinations.
  if (mem8[GAME_STATE] !== 1) return yield* stepRoundSubPhaseAndBranch(m);

  // First leg: clear the other player's backup man count, then route by men in reserve.
  mem8[PLAYER2_MEN_BACKUP] = 0;
  mem8[ACTIVE_PLAYER] = 1;
  if (mem8[PLAYER1_MEN_BACKUP] !== 0) return yield* setUpRoundAndHoldIntro(m); // men left -> set up the next round
  return yield* submitHighScoresAndReset(m); // none left -> end-of-round teardown
}
