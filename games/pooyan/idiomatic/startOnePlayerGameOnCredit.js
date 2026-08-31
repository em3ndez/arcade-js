// SPDX-License-Identifier: GPL-3.0-only
import { startNewGamePlay } from "./startNewGamePlay.js";
import { CREDIT_COUNT, PLAY_STATE_INDEX, MAIN_GAME_STATE } from "./names.js";
/**
 * startOnePlayerGameOnCredit — the one-player start-button branch.
 *
 * ROM 0x0de4.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The handler reached the moment the ONE-PLAYER start button is pressed. Each frame the input
 *   service samples the coin/start hardware port into INPUT_PORT0 (0x8810). That port is active-low
 *   and the machine inverts it on the way in, so a pressed control shows up as a set bit: bit 0 is
 *   a coin, bit 3 the one-player start, and bit 4 the two-player start. The start post-handler
 *   (ROM 0x0d78) tests bit 3 and, when it is set, hands control here.
 *
 * ROLE IN THE MACHINE
 *   This is the gate between "the one-player start button was pressed" and "a game is running".
 *   Starting a game costs a credit, so the branch splits on whether the cabinet holds any:
 *     - With a credit banked, it spends one and commits to a fresh single-player game.
 *     - With no credit, no game can begin, so the press instead only advances the top-level state
 *       machine one step off its current screen.
 *   CREDIT_COUNT (0x8802) is the running stock of credits; a game costs exactly one, and both
 *   game-start paths in the machine gate on this cell being nonzero (free play aside).
 *
 * LIVE-OUT: memory only — callers read no register back. On the credit path it drops CREDIT_COUNT
 *   by one and hands off to startNewGamePlay (which writes the full raft of start-of-life state
 *   cells); on the empty path it either leaves state untouched or sets MAIN_GAME_STATE to 1.
 */
const PLAY_STATE_LOCKED = 0x0e; //  the locked in-play sub-state; a credit-less start press is dropped here

export function startOnePlayerGameOnCredit(m) {
  const { mem8 } = m;

  // Credit path — a game can be paid for and started (ROM 0x0de4: ld a,(0x8802); and a; jr z).
  // CREDIT_COUNT (0x8802) is the credit stock; when it is nonzero at least one game is affordable.
  if (mem8[CREDIT_COUNT] !== 0) {
    // Pay for the game: take one credit off the count (ROM 0x0dea: dec a; ld (0x8802),a).
    mem8[CREDIT_COUNT] = (mem8[CREDIT_COUNT] - 1);
    // Commit to the fresh single-player game (ROM 0x0dee: ld hl,0x0000; 0x0df1: jp 0x0dab into
    // startNewGamePlay). The configuration word 0x0000 gives start-of-life setup a low byte of 0
    // (active player = player 0) and a high byte of 0 (two-player flag clear) — i.e. a plain
    // single-player game. startNewGamePlay commits that player configuration, switches
    // MAIN_GAME_STATE to the play value, and opens the first life.
    return startNewGamePlay(m, 0x00); //  start a single-player game
  }

  // Empty path — no credit, so no game can begin (ROM 0x0df4). Read the in-play sub-state index
  // PLAY_STATE_INDEX (0x880a): when it holds the locked value 0x0e the machine is in a phase that
  // must not be disturbed, so the start press is simply dropped (ROM 0x0df7: cp 0x0e; ret z).
  if (mem8[PLAY_STATE_INDEX] === PLAY_STATE_LOCKED) return;
  // Otherwise the press still advances the machine one top-level step (ROM 0x0dfa: ld a,1;
  // ld (0x8805),a). MAIN_GAME_STATE (0x8805) is the master selector the per-frame service
  // dispatches through table 0x06f0; value 1 selects the attract-substate handler (0 = attract/boot,
  // 1 = attract substates, 2 = board build, 3 = play, 4 = idle).
  mem8[MAIN_GAME_STATE] = 1;
}
