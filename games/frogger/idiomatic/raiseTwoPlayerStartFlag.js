// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseTwoPlayerStartFlag  —  ROM 0x07ce (bytes 0x07CE-0x07D8)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The player-1 arm of the board-start "start flag" raise. It conditionally raises
 *   TWO_PLAYER_START_FLAG (0x825b) to 1, but ONLY while a board advance is pending — otherwise it
 *   leaves the flag exactly as it found it. It is a tiny leaf routine: one guarded RAM read, one
 *   conditional RAM write, no callees.
 *
 *   The name is historical and slightly misleading. TWO_PLAYER_START_FLAG is not really a
 *   "two-player mode" bit — it is a SPRITE-PLOT SUPPRESSION latch. While it is non-zero the shared
 *   frog-animation renderer renderFrogAnimTileColumns (0x0ff1) skips plotting the frog's sprite
 *   columns (see mechanisms.md). Raising it here parks the frog sprite out of the way for the
 *   duration of the board-complete / board-advance reveal, so the frog-anim plot does not draw over
 *   the reveal animation.
 *
 * WHERE IT SITS
 *   Reached from raiseActivePlayerStartFlag (0x07c1): when the active player is player 1
 *   (ACTIVE_PLAYER 0x83fd == 1) that routine tail-calls HERE; for any other player it writes the flag
 *   directly, bypassing this guard. raiseActivePlayerStartFlag is itself invoked from the two-player
 *   board-start path in setUpBoardOrContinueLife, which raises the start flag and then, one step later,
 *   clears the board-advance request. So on the frame this helper fires the request cell is still set —
 *   which is exactly why the guard below lets the write through.
 *
 * LIVE-OUT
 *   Memory only. It writes at most one cell (TWO_PLAYER_START_FLAG). A and the Z flag are clobbered in
 *   the ROM but are not read by any caller, so they are not live-out. It returns nothing.
 */
import { BOARD_ADVANCE_REQUEST, TWO_PLAYER_START_FLAG } from "./names.js";

export function raiseTwoPlayerStartFlag(m) {
  const { mem8 } = m;

  // ── Guard: only raise the flag while a board advance is pending ───────────────────────
  // BOARD_ADVANCE_REQUEST (0x826d) is the board-complete-pending flag: loc_05d3 (0x05d3) sets it to 1
  // when all five frogs have reached their home bays, and the board-advance foreground reads it before
  // clearing it. This is the cell whose old, mistaken "two-player mode flag" reading gave this routine
  // its name — grounding OVERTURNED that: it is a board-advance request, not a mode bit.
  //
  // When it is 0 there is no board advance under way, so there is nothing to suppress the frog sprite
  // for: fall straight through and leave TWO_PLAYER_START_FLAG untouched. (In the ROM this is `and a` +
  // `ret z` — a zero A returns without writing.)
  if (mem8[BOARD_ADVANCE_REQUEST] === 0) return;

  // ── Raise the start / plot-suppression flag ──────────────────────────────────────────
  // A board advance IS pending. Set TWO_PLAYER_START_FLAG (0x825b) = 1. Downstream this makes
  // renderFrogAnimTileColumns (0x0ff1) skip plotting the frog's sprite columns, parking the frog out of
  // the reveal animation. It is later cleared again by the board-setup path (e.g. loc_05d3, setUpPlayStartOnce,
  // swapOutActivePlayerPages) once the new board is laid out.
  mem8[TWO_PLAYER_START_FLAG] = 1;
}
