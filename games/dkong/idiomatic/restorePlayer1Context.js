// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer1Context — restore player 1's saved context, re-derive the board, and arm the next
 * sub-state.
 *
 * Run at the start of player 1's turn. Three acts, in this order:
 *
 *   1. RESTORE. Copy P1's saved 8-byte context over the LIVE context block, whose first cell is
 *      LIVES: lives, level, the board-sequence pointer, and the progress bytes after it.
 *   2. RE-DERIVE the board type: follow the just-restored board-sequence pointer and copy the byte
 *      it points at into BOARD (1 = 25m, 2 = 50m, 3 = 75m, 4 = 100m). THE ORDERING IS
 *      LOAD-BEARING: the copy in act 1 spans the pointer itself, so this deref must read the
 *      freshly restored pointer, not the one that was there before.
 *   3. ARM the next sub-state from TWO_PLAYER_GAME. A two-player game gets the player-alternation
 *      screen — a 120-frame hold, sub-state 2 — while a one-player game proceeds immediately, with
 *      a 1-frame hold and sub-state 5. Any non-zero value counts as two-player.
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
  const { mem } = m;

  // 1. Restore P1's saved 8-byte context into the live context block. This overwrites
  //    BOARD_SEQ_PTR, so act 2 reads the restored pointer, not the old one.
  for (let i = 0; i < 8; i++) {
    mem.write8(LIVES + i, mem.read8(P1_CONTEXT + i));
  }

  // 2. Re-derive the board type by dereferencing the (now-restored) sequence pointer.
  mem.write8(BOARD, mem.read8(mem.read16(BOARD_SEQ_PTR)));

  // 3. Arm the next sub-state: two-player -> alternation screen; one-player -> proceed.
  if (mem.read8(TWO_PLAYER_GAME) === 0) {
    mem.write8(SUBSTATE_TIMER, 0x01);
    mem.write8(GAME_SUBSTATE, 0x05);
  } else {
    mem.write8(SUBSTATE_TIMER, 0x78);
    mem.write8(GAME_SUBSTATE, 0x02);
  }
}
