// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer2Context — reinstate Player 2's saved game context and arm the
 * start-of-turn wait.  ROM 0x09FE.
 *
 * In a two-player game each player keeps a private 8-byte context save slot; the
 * live context the engine actually runs against is a single block at
 * LIVES..HOW_HIGH_LAST_SEQ (0x6228-0x622F: lives, level, board-sequence pointer,
 * play-intro flag, bonus-life latch, how-high index/last-seq). When control passes
 * to player 2, this routine copies P2's save slot (P2_CONTEXT, 0x6048) over that
 * live block, then:
 *
 *   - Re-derives BOARD (0x6227) from the restored board-sequence pointer. The just-
 *     copied BOARD_SEQ_PTR (0x622A/0x622B) is a 16-bit ROM address into the board-
 *     order table; BOARD is the cached byte that address points at (1=25m .. 4=100m),
 *     refreshed on every context restore so it tracks P2's own board progress.
 *   - Arms the "wait N frames, then run sub-state M" idiom: SUBSTATE_TIMER (0x6009)
 *     = 0x78 (120 frames) and GAME_SUBSTATE (0x600A) = 4, the sub-state that opens
 *     player 2's turn.
 *
 * The mirror of loc_09ab (the P1 restore, 0x6040 -> 0x6228). P2's variant arms
 * sub-state 4 unconditionally; P1's branches on TWO_PLAYER_GAME to pick sub-state
 * 5 (1P) vs 2 (2P). A LEAF: reads only RAM (P2's save slot, the restored pointer +
 * its ROM target), writes only RAM, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-09fe.test.js.
 * GATE:     crafted-entry — attract is 1-player and never reaches P2 restore, so
 *           it is validated on REAL captured dispatches from a driven 2-coin +
 *           START2 run (P1 dies, control passes to P2, dispatches ~frame 1661)
 *           PLUS crafted identical-both-sides entries spanning distinct board-seq
 *           pointers, save-slot payloads, and pre-dirtied destinations. Straight-
 *           line, so those are full path coverage. Fresh clone per case (it writes RAM).
 * LIVE-OUT: memory-only — the live context block (LIVES..HOW_HIGH_LAST_SEQ), BOARD,
 *           SUBSTATE_TIMER, GAME_SUBSTATE. The caller dispatchGameState returns
 *           straight after the dispatch and consumes no register/flag; the oracle's
 *           terminal `ret` (an SP+2 pop) is the modelled stack ABI the direct-call
 *           layer replaces with a JS return, so SP/pc are not live either.
 * NAMES:    P2_CONTEXT, LIVES (live-block base), BOARD, BOARD_SEQ_PTR,
 *           SUBSTATE_TIMER, GAME_SUBSTATE — all from optimized/ram.js.
 */

import {
  P2_CONTEXT,
  LIVES,
  BOARD,
  BOARD_SEQ_PTR,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "../optimized/ram.js";

// The live context block is 8 bytes, based at LIVES (0x6228) and running through
// HOW_HIGH_LAST_SEQ (0x622F). P2_CONTEXT (0x6048) is P2's matching 8-byte save slot.
const CONTEXT_BYTES = 8;

// The turn-start arm: wait 0x78 (120) frames, then enter sub-state 4.
const TURN_START_WAIT = 0x78;
const P2_TURN_SUBSTATE = 4;

export function restorePlayer2Context(m) {
  const { mem } = m;

  // Reload the live context block from P2's save slot (source and dest do not
  // overlap, so a plain forward copy is identical to the ROM's `ldir`).
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem.write8(LIVES + i, mem.read8(P2_CONTEXT + i));
  }

  // Refresh BOARD from *BOARD_SEQ_PTR — the byte the just-restored 16-bit
  // board-order pointer points at.
  const boardId = mem.read8(mem.read16(BOARD_SEQ_PTR));
  mem.write8(BOARD, boardId);

  // Arm player 2's turn: 120-frame wait, then sub-state 4.
  mem.write8(SUBSTATE_TIMER, TURN_START_WAIT);
  mem.write8(GAME_SUBSTATE, P2_TURN_SUBSTATE);
}
