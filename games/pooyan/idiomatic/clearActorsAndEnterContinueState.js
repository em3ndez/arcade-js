// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
import { stampCappedTileColumnUp } from "./stampCappedTileColumnUp.js";
import { resetGameToAttractState } from "./resetGameToAttractState.js";
import {
  SPEED_INDEX,
  TWO_PLAYER_FLAG,
  CREDIT_COUNT,
  GAME_ACTIVE_FLAG,
  PLAY_STATE_INDEX,
  FLIP_SCREEN_FLAG,
  MAIN_GAME_STATE,
} from "./names.js";
/**
 * clearActorsAndEnterContinueState — full-clear tail of the play-state dispatch handler.
 *
 * WHAT IT IS
 *   ROM 0x1d15-0x1d3b. Grounding: [seen].
 *   The terminal branch of round-end handling. When a player has just run out of lives at the
 *   close of a round, the round-end master (the last play sub-state, index 14) reaches here to
 *   wipe that player's live working state and then decide, purely on the remaining credit,
 *   whether the cabinet carries on into another board or falls all the way back to the attract
 *   demo.
 *
 * ITS ROLE IN THE MACHINE
 *   Pooyan runs off a three-deep state machine. The top-level selector MAIN_GAME_STATE (0x8805)
 *   picks the mode each frame — state 1 the attract/demo sub-state machine, state 2 the
 *   board-build sequence, state 3 the live play frame. Inside live play a second selector,
 *   PLAY_STATE_INDEX (0x880a), walks the round through its phases (intro, wave spawn, active
 *   play, phase-gauge drain, bank save, high-score entry, and the round-end teardown chain).
 *   This routine is one tail of that teardown chain: the "no lives left for this player" exit.
 *   From here the machine either continues (drop to board-build state 2 and lay out the next
 *   board for the paid-up player) or, with the credit box empty, tears everything down cold and
 *   hands the top level back to the attract loop.
 *
 * LIVE-OUT: none — a void handler. Every effect lands in memory: the zeroed live actor page,
 *   the stamped scroll column, and then either the full attract teardown (via the delegate) or
 *   the four continue-state cells set below. Nothing is returned to the caller.
 */

// The live actor page runs 0xbf bytes from SPEED_INDEX (0x8900) — 0x8900..0x89be. Its first 0x3f
// bytes are the swappable per-player block; the whole span is wiped wholesale on a board reset.
const PAGE_LEN = 0xbf;
// Value written to MAIN_GAME_STATE (0x8805) on the continue path: state 2 is the board-build
// sequence, which lays out the next board before handing control back to live play.
const CONTINUE_STATE = 2;

export function clearActorsAndEnterContinueState(m) {
  const { mem8 } = m;

  // STEP 1 — wipe the live actor page.
  // SPEED_INDEX (0x8900) is the base of the active player's live working page. Zero-filling all
  // 0xbf bytes (through 0x89be) erases every actor, timer, and per-player state the finished
  // round left behind, so whatever runs next — a continued board or the attract demo — starts on
  // a clean page. The write is the machine's generic memset primitive at ROM 0x0010.
  fillByteRun(m, SPEED_INDEX, 0, PAGE_LEN); // zero-fill the live actor page

  // STEP 2 — stamp the mode-appropriate scroll column back into the tilemap.
  // The playfield background is a tilemap: one tile-code byte per cell in video RAM, with screen
  // rows a fixed 0x20 (32) bytes apart and growing DOWNWARD in address (a cell one row up on
  // screen sits 0x20 bytes lower in memory). TWO_PLAYER_FLAG (0x880e) selects which fixed
  // three-tile column graphic to lay down: a one-player game stamps the 0x87xx scroll column
  // (cap 0x01 at 0x8740, body tiles 0x25/0x20 one and two rows up); a two-player game stamps the
  // capped 0x84xx column (cap 0x02 at 0x84e0, body 0x25/0x20 up). Exactly one branch runs.
  if (mem8[TWO_PLAYER_FLAG] === 0) stampSecondScrollColumn(m); // fixed-stride paint
  else stampCappedTileColumnUp(m); // cap-first column stamp

  // STEP 3 — the credit gate: continue only if there is money to continue with.
  // CREDIT_COUNT (0x8802) is the BCD credit counter (coins add, starts consume). When it reads
  // zero the finished player cannot buy another turn, so control tails to the cold teardown
  // resetGameToAttractState (ROM 0x1d3c): it wipes the whole in-play state block and drops the
  // top level to state 1, returning the cabinet to its idle attract demo. The delegate does all
  // remaining work, so this returns immediately and the continue-state writes below never run.
  if (mem8[CREDIT_COUNT] === 0) return resetGameToAttractState(m); // no credit -> cold teardown

  // STEP 4 — the continue path: arm the board-build state for the paid-up player.
  // Credit remains, so instead of tearing down we set the machine up to build the next board.
  // Clear GAME_ACTIVE_FLAG (0x8806) so the in-play handlers stay dormant until the new board is
  // armed; clear PLAY_STATE_INDEX (0x880a) so the play sub-state dispatch restarts from its first
  // phase; set FLIP_SCREEN_FLAG (0x881f) to 1 to restore normal (upright) orientation, the value
  // mirrored to the flip-screen hardware latch (0xa187 bit7) each vblank; and set MAIN_GAME_STATE
  // (0x8805) to CONTINUE_STATE (2), handing the top level to the board-build sequence.
  mem8[GAME_ACTIVE_FLAG] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[FLIP_SCREEN_FLAG] = 1;
  mem8[MAIN_GAME_STATE] = CONTINUE_STATE;
}
