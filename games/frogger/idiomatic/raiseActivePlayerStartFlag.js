// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseActivePlayerStartFlag  —  ROM 0x07c1  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The active-player selector arm of the board-start "start flag" raise. On a two-player board start it
 *   decides HOW the start flag TWO_PLAYER_START_FLAG (0x825b) gets raised for whichever player is now on
 *   the machine: player 1 routes through the guarded helper raiseTwoPlayerStartFlag (which raises the flag
 *   only while a board advance is actually pending), while any other player number has the flag written
 *   straight to 1, unconditionally.
 *
 *   Despite the name, TWO_PLAYER_START_FLAG is NOT a "two-player mode" bit — grounding overturned that
 *   historical reading. It is a SPRITE-PLOT SUPPRESSION latch: while it is non-zero the shared
 *   frog-animation renderer renderFrogAnimTileColumns (0x0ff1) skips plotting the frog's sprite columns
 *   (see mechanisms.md). Raising it here parks the frog sprite out of the way while the board is being
 *   (re)laid, so the frog-anim plot does not draw over the board-start / reveal animation.
 *
 * WHERE IT SITS
 *   Called from the two-player board-start path in setUpBoardOrContinueLife (the per-frame board-start /
 *   life-loss dispatcher). That caller raises the active player's start flag HERE and then, one step
 *   later, clears the board-advance request BOARD_ADVANCE_REQUEST (0x826d). So on the frame this routine
 *   fires the request cell is still set — which is exactly what lets the guarded player-1 helper's write
 *   through.
 *
 *   The two arms are asymmetric by design. Player 1 delegates to raiseTwoPlayerStartFlag (0x07ce), which
 *   guards its write on BOARD_ADVANCE_REQUEST; any other player number falls straight through to the
 *   direct, unguarded write below.
 *
 * LIVE-OUT
 *   Memory only. It raises at most one cell (TWO_PLAYER_START_FLAG, directly or via the helper) and
 *   returns nothing. The ROM leaves the player number in A, but the caller discards A right after, so it
 *   is not live-out.
 */
import { TWO_PLAYER_START_FLAG, ACTIVE_PLAYER } from "./names.js";
import { raiseTwoPlayerStartFlag } from "./raiseTwoPlayerStartFlag.js";

// The active player is stored as a 1-based number; 1 is the player-1 arm that routes through the guard.
const ACTIVE_PLAYER_ONE = 1;

export function raiseActivePlayerStartFlag(m) {
  const { mem8 } = m;

  // ── Branch on the active player ──────────────────────────────────────────────────────
  // ACTIVE_PLAYER (0x83fd) holds the number of the player now on the machine (1 or 2). Player 1 does NOT
  // raise the flag directly — it routes through the guarded helper raiseTwoPlayerStartFlag (0x07ce), which
  // raises TWO_PLAYER_START_FLAG only while BOARD_ADVANCE_REQUEST (0x826d) is non-zero. This is a plain
  // tail-call: run the helper, return whatever it returns (nothing) to our caller.
  if (mem8[ACTIVE_PLAYER] === ACTIVE_PLAYER_ONE) return raiseTwoPlayerStartFlag(m);

  // ── Non-player-1: raise the start / plot-suppression flag unconditionally ─────────────
  // Any player other than 1 skips the guard entirely and writes TWO_PLAYER_START_FLAG (0x825b) = 1
  // directly. Downstream this makes renderFrogAnimTileColumns (0x0ff1) suppress the frog's sprite-column
  // plot, parking the frog off-board while the board is laid out. It is later cleared again by the
  // board-setup path (e.g. loc_05d3, setUpPlayStartOnce, swapOutActivePlayerPages) once the board is up.
  mem8[TWO_PLAYER_START_FLAG] = 1;
}
