// SPDX-License-Identifier: GPL-3.0-only
// Credit-gated round start: with no credits left, force the game state to 1 and stop. Otherwise spend
// one credit, zero the saved-state snapshot, and enter a round start with a null spawn pointer.
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { startGameRoundAndClearScores } from "./startGameRoundAndClearScores.js";
import { loc_4002, GAME_STATE, SAVED_STATE_SNAPSHOT } from "./names.js";

const SNAPSHOT_BYTES = 32;

export function loc_04f2(m) {
  const { mem8 } = m;

  if (mem8[loc_4002] === 0) {
    mem8[GAME_STATE] = 1;
    return;
  }

  mem8[loc_4002] = mem8[loc_4002] - 1; // spend one credit
  fillMemoryBlock(m, SAVED_STATE_SNAPSHOT, 0, SNAPSHOT_BYTES);
  return startGameRoundAndClearScores(m, 0);
}
