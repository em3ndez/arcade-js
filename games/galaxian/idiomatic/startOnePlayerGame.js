// SPDX-License-Identifier: GPL-3.0-only
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { startGameRoundAndClearScores } from "./startGameRoundAndClearScores.js";
import { loc_4002, GAME_STATE, SAVED_STATE_SNAPSHOT } from "./names.js";

const SNAPSHOT_BYTES = 32;

/**
 * startOnePlayerGame (ROM 0x04f2) -- the one-player start arm.
 *
 * WHAT IT IS
 *   The bit0 (1-player-start button) path of beginGameOnStartButton. It is credit-gated: with no credit
 *   banked it bounces the machine back to attract; with a credit it spends one, wipes the second-player
 *   save slot, and enters a fresh round as a single player.
 *
 * ROLE IN THE MACHINE
 *   One of the two launch paths off the press-start screen (the other is the two-player path inside
 *   beginGameOnStartButton). Both converge on startGameRoundAndClearScores; this one passes spawn word 0,
 *   which leaves CURRENT_PLAYER's high byte (the two-player flag) clear -- a one-player game.
 *
 * Grounding: [seen] (names.js ROUTINES 0x04f2). Its only own write is the credit spend (loc_4002); the
 *   actual round setup is delegated, so this routine itself is not write-grounded.
 *
 * LIVE-OUT: memory. On the no-credit branch, GAME_STATE (0x4005)=1 (back to attract). On the start branch:
 *   loc_4002 (0x4002, credit count) decremented, SAVED_STATE_SNAPSHOT (0x41a0) zeroed, then whatever
 *   startGameRoundAndClearScores leaves (GAME_STATE=3, play begun).
 */
export function startOnePlayerGame(m) {
  const { mem8 } = m;

  // Credit gate: loc_4002 (0x4002) is the credit count. With no credit banked there is nothing to start,
  // so force GAME_STATE (0x4005) back to 1 (attract) and stop -- the start button was pressed on empty.
  if (mem8[loc_4002] === 0) {
    mem8[GAME_STATE] = 1;
    return;
  }

  // Spend one credit for the game about to begin.
  mem8[loc_4002] = mem8[loc_4002] - 1; // spend one credit
  // Clear the second-player save slot: zero the 32-byte SAVED_STATE_SNAPSHOT (0x41a0) so no stale board
  // from a prior two-player game can be restored. (Only meaningful defensively here since this is 1-player.)
  fillMemoryBlock(m, SAVED_STATE_SNAPSHOT, 0, SNAPSHOT_BYTES);
  // Enter the round through the shared start entry with spawn word 0 -> one-player game (GAME_STATE=3).
  return startGameRoundAndClearScores(m, 0);
}
