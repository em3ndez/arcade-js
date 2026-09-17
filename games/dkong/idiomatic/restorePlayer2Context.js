// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer2Context — copy player 2's saved 8-byte context slot over the live context
 * block, re-derive BOARD from the restored board-sequence pointer, and arm the start-of-turn
 * wait (120 frames, then sub-state 4). Unconditional; contains no branch.
 *
 * LIVE-OUT: memory-only — the live context block, BOARD, and the two sub-state arm cells.
 */
import {
  P2_CONTEXT,
  LIVES,
  BOARD,
  BOARD_SEQ_PTR,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "./names.js";

const CONTEXT_BYTES = 8; // live context block, based at LIVES
const TURN_START_WAIT = 0x78;
const P2_TURN_SUBSTATE = 4;

export function restorePlayer2Context(m) {
  const { mem8, mem16 } = m;

  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem8[LIVES + i] = mem8[P2_CONTEXT + i];
  }

  const boardId = mem8[mem16[BOARD_SEQ_PTR]];
  mem8[BOARD] = boardId;

  mem8[SUBSTATE_TIMER] = TURN_START_WAIT;
  mem8[GAME_SUBSTATE] = P2_TURN_SUBSTATE;
}
