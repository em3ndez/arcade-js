// SPDX-License-Identifier: GPL-3.0-only
import { advanceGameStateOnCreditOrStartPress } from "./advanceGameStateOnCreditOrStartPress.js";
import { resetBoardRamAndReseedSpawnCounters } from "./resetBoardRamAndReseedSpawnCounters.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { u16 } from "../../../core/int.js";
import {
  GAME_ACTIVE_FLAG,
  COINAGE_CONFIG,
  CREDIT_COUNT,
  MAIN_GAME_STATE,
  PLAY_STATE_INDEX,
  RESET_ATTR_COLUMN,
} from "./names.js";
/**
 * resetToBoardBuildToContinuePlay — the play frame's end-of-life housekeeping step.
 *
 * WHAT IT IS
 *   ROM 0x15d1-0x1600. Grounding: [seen].
 *   This is the tail continuation of the top-level play handler (runPlayStateFrame, the
 *   handler for MAIN_GAME_STATE == 3). Every play frame does three things in order: tick the
 *   active player's play timer, run the in-play sub-state dispatcher, then fall through here.
 *   So this executes once at the very end of each play frame, after the selected sub-state
 *   handler has already advanced its part of the round.
 *
 * ROLE IN THE MACHINE
 *   The top-level state selector MAIN_GAME_STATE (0x8805) picks one of five machines each
 *   frame: 0 attract/boot, 1 attract sub-state, 2 board build, 3 live play, 4 idle no-op.
 *   This step is what carries the machine OUT of state 3 once a game has ended. It is the
 *   hand-off from a finished game back to the board-build subsystem (state 2) to assemble the
 *   next game's board — or, when nothing more can start, a deferral to the attract epilogue
 *   or a parked idle.
 *
 * THE DECISION
 *   - game still live   -> do nothing and return (stay in play)
 *   - free-play cabinet -> tail to the shared attract epilogue
 *   - no credit banked  -> return, leaving the machine parked out of play
 *   - a credit banked   -> reset into board build and stage the next game's board
 *
 * LIVE-OUT (only on the credit-banked path; the three early returns touch no memory)
 *   MAIN_GAME_STATE (0x8805) = 2 (board build) and PLAY_STATE_INDEX (0x880a) = 0; the board
 *   and HUD RAM re-initialised; the sprite display list and actor/object arena zeroed; and an
 *   eight-tile attribute column blanked from RESET_ATTR_COLUMN (0x855f) upward.
 */
const BOARD_BUILD_STATE = 0x02;
const FREE_PLAY = 0x0f;
const BLANK_TILE = 0x10;
const COLUMN_HEIGHT = 0x08;
const ROW_STRIDE = 0x20; // one tilemap row is 0x20 tiles; the column is walked upward, so the address descends one stride per step

export function resetToBoardBuildToContinuePlay(m) {
  const { mem8 } = m;

  // GAME_ACTIVE_FLAG (0x8806) is the in-play gate: set to 1 at start-of-life and cleared to 0
  // at game-over. While a game is still in progress there is nothing to continue — leave the
  // machine in play (state 3) and hand control back to the frame caller.
  if (mem8[GAME_ACTIVE_FLAG] !== 0) return; // game still live -> nothing to do

  // COINAGE_CONFIG (0x882c) is the coin-1 coinage nibble decoded from the DIP switches at boot;
  // the sentinel 0x0f means free play. A free-play cabinet has no credits to spend, so the game
  // does not restart from here — it defers to the shared attract epilogue, which watches the
  // start buttons directly to bring the next game up.
  if (mem8[COINAGE_CONFIG] === FREE_PLAY) return advanceGameStateOnCreditOrStartPress(m); // free play -> shared epilogue tail

  // CREDIT_COUNT (0x8802) is the BCD credit counter. With no credit banked there is nothing to
  // start: return and leave the machine parked out of play (the attract/credit screens take
  // over on later frames).
  if (mem8[CREDIT_COUNT] === 0) return; // no credit -> stay put

  // A credit is banked, so begin the next game. Point the top-level selector back at the
  // board-build machine (MAIN_GAME_STATE state 2) and rewind its sub-state index to 0 so the
  // board-build sequence starts from its first phase on the next frame.
  mem8[MAIN_GAME_STATE] = BOARD_BUILD_STATE; // rebuild the board next
  mem8[PLAY_STATE_INDEX] = 0x00;

  // Re-initialise the board/HUD RAM — enqueue the board display command, conditionally reseed
  // the spawn-phase and rope-draw counters, clear the board RAM blocks and mirror the fill value
  // into the actor/HUD cells ...
  resetBoardRamAndReseedSpawnCounters(m); // board/HUD reset
  // ... then wipe the moving-object world clean: the staged sprite display list and the
  // actor/object arena RAM, so no stale actors survive into the fresh board.
  zeroSpriteListAndActorArena(m); // clear the actor/object arena

  // Blank the round-HUD field column. RESET_ATTR_COLUMN (0x855f) is the bottom cell of that
  // column and BLANK_TILE (0x10) is the blank-tile code. Write the blank code into eight cells,
  // stepping up one tilemap row each time — subtracting ROW_STRIDE (0x20) from the address, so
  // the walk goes 0x855f, 0x853f, 0x851f, ... — clearing the column's leftover tiles from the
  // previous game.
  let cell = RESET_ATTR_COLUMN;
  for (let i = 0; i < COLUMN_HEIGHT; i++) { // blank the column, one row up per step
    mem8[cell] = BLANK_TILE;
    cell = u16(cell - ROW_STRIDE);
  }
}
