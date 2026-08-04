// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer2Context — reinstate player 2's saved game context and arm the start-of-turn
 * wait.
 *
 * In a two-player game each player keeps a private eight-byte context save slot, while the
 * engine runs against a single LIVE context block: lives, level, board-sequence pointer,
 * play-intro flag, bonus-life latch, and the how-high bookkeeping. When control passes to
 * player 2, this routine copies player 2's slot over that live block, then:
 *
 *   - Re-derives BOARD from the restored board-sequence pointer. The pointer just copied in
 *     is a 16-bit address into the board-order table, and BOARD is the cached byte living at
 *     that address (1 = 25m through 4 = 100m). Refreshing it here is what makes the board
 *     follow player 2's own progress instead of whatever the other player left behind.
 *   - Arms the "wait N frames, then run sub-state M" idiom: a 120-frame wait, then the
 *     sub-state that opens player 2's turn.
 *
 * Every write is unconditional; the routine contains no branch at all, so there is nothing
 * here that a particular saved context can steer.
 *
 * A leaf: it reads memory — player 2's save slot, and the byte the restored pointer targets —
 * writes memory, and calls nothing.
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

// The live context block is 8 bytes, based at LIVES; player 2's save slot is its
// matching 8 bytes.
const CONTEXT_BYTES = 8;

// The turn-start arm: wait 0x78 (120) frames, then enter sub-state 4.
const TURN_START_WAIT = 0x78;
const P2_TURN_SUBSTATE = 4;

export function restorePlayer2Context(m) {
  const { mem } = m;

  // Reload the live context block from player 2's save slot. Source and destination do
  // not overlap, so a plain forward copy is exact.
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem.write8(LIVES + i, mem.read8(P2_CONTEXT + i));
  }

  // Refresh BOARD with the byte the just-restored 16-bit board-order pointer targets.
  const boardId = mem.read8(mem.read16(BOARD_SEQ_PTR));
  mem.write8(BOARD, boardId);

  // Arm player 2's turn: 120-frame wait, then sub-state 4.
  mem.write8(SUBSTATE_TIMER, TURN_START_WAIT);
  mem.write8(GAME_SUBSTATE, P2_TURN_SUBSTATE);
}
