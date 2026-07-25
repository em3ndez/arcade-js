// SPDX-License-Identifier: GPL-3.0-only
/**
 * restorePlayer1Context — restore player 1's saved context, re-derive the board,
 * and arm the next sub-state.  ROM 0x09AB.
 *
 * Run at the start of player 1's turn (dispatched by the in-game sub-state machine
 * when a game/board begins). Three acts, in this order:
 *
 *   1. Restore P1's saved 8-byte context (P1_CONTEXT, 0x6040) into the LIVE context
 *      block at 0x6228 — LIVES, LEVEL, the board-sequence pointer, PLAY_INTRO,
 *      BONUS_LIFE_AWARDED, HOW_HIGH_INDEX, HOW_HIGH_LAST_SEQ. This is the `ldir`
 *      counterpart of the on-death save at ROM 0x12FE. Because the copy spans
 *      BOARD_SEQ_PTR (0x622A/0x622B), the deref in act 2 MUST read the FRESHLY
 *      restored pointer — the ordering is load-bearing.
 *   2. Re-derive the current board type: follow the just-restored board-sequence
 *      pointer and copy the byte it points at (1=25m, 2=50m, 3=75m, 4=100m) into
 *      BOARD (0x6227).
 *   3. Arm the next sub-state from TWO_PLAYER_GAME (0x600F). A two-player game shows
 *      the player-alternation screen — SUBSTATE_TIMER = 0x78 (120-frame hold),
 *      GAME_SUBSTATE = 2 — while a one-player game proceeds immediately —
 *      SUBSTATE_TIMER = 1, GAME_SUBSTATE = 5. (`and a` sets Z iff 0x600F == 0, so
 *      ANY non-zero value takes the two-player arm.)
 *
 * The player-2 twin is sub_09fe (0x6048 -> 0x6228, then arms sub-state 4).
 *
 * Memory-equivalent to the frozen oracle — equivalence-09ab.test.js.
 * GATE:     crafted-entry — one REAL driven dispatch (coin+start tape reaches it at
 *           frame 33 on the 0x600F==0 / one-player arm) + crafted clones of that entry
 *           for the two-player arm (poke 0x600F) and a distinct-byte context pattern
 *           that pins every ldir byte and the ldir-before-deref ordering independently.
 *           Teeth: an arm-swap twin and a stale-pointer (deref-before-ldir) twin.
 * LIVE-OUT: memory-only. Reached via the vblank rst-0x28 sub-state dispatch, which
 *           consumes none of the routine's residual registers/flags (dead ABI, backstopped
 *           by the whole-machine gate). The oracle touches the stack only via its final
 *           `ret` (a pop, no write), so pc/SP carry no residue — the harness supplies the
 *           matching ret.
 * NAMES:    P1_CONTEXT, LIVES (base of the live context block), BOARD_SEQ_PTR, BOARD,
 *           TWO_PLAYER_GAME, SUBSTATE_TIMER, GAME_SUBSTATE — all from ram.js.
 */
import {
  P1_CONTEXT,
  LIVES,
  BOARD_SEQ_PTR,
  BOARD,
  TWO_PLAYER_GAME,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "../optimized/ram.js";

export function restorePlayer1Context(m) {
  const { mem } = m;

  // 1. Restore P1's saved 8-byte context into the live context block (0x6228..0x622F).
  //    This overwrites BOARD_SEQ_PTR, so act 2 reads the restored pointer, not the old one.
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
