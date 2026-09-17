// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer1Context — at the start of P1's turn: copy P1's saved 8-byte context over the live
 * block (LIVES..progress), re-derive BOARD by dereferencing the just-restored board-sequence
 * pointer, then arm the next sub-state (two-player -> alternation screen, 0x78 hold / sub-state 2;
 * one-player -> proceed, 1 hold / sub-state 5). The restore-before-deref ordering is load-bearing.
 *
 * LIVE-OUT: memory-only.
 */
import {
  P1_CONTEXT,
  LIVES,
  BOARD_SEQ_PTR,
  BOARD,
  TWO_PLAYER_GAME,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "./names.js";

export function restorePlayer1Context(m) {
  const { mem8, mem16 } = m;

  // Restore spans BOARD_SEQ_PTR, so the deref below must follow it.
  for (let i = 0; i < 8; i++) {
    mem8[LIVES + i] = mem8[P1_CONTEXT + i];
  }

  mem8[BOARD] = mem8[mem16[BOARD_SEQ_PTR]];

  if (mem8[TWO_PLAYER_GAME] === 0) {
    mem8[SUBSTATE_TIMER] = 0x01;
    mem8[GAME_SUBSTATE] = 0x05;
  } else {
    mem8[SUBSTATE_TIMER] = 0x78;
    mem8[GAME_SUBSTATE] = 0x02;
  }
}
