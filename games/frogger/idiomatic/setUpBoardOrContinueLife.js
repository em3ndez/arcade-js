// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpBoardOrContinueLife  —  ROM 0x040b  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame board-start / life-loss dispatcher. It runs one foreground pass of the in-play tree and
 *   decides, from a single latch, which of two jobs this frame needs: either the board is already drawn and
 *   we are between lives (hand off to the continue / next-life path), or the board must be laid out from
 *   scratch (clear + redraw the whole playfield, HUD, and lives, then latch the "board is laid" flag so
 *   subsequent frames stop rebuilding it). The routine is idempotent by design: it writes only constants
 *   and re-derived render state — never a value it increments — so running its body twice between two
 *   vblanks reproduces the identical RAM as running it once (see mechanisms.md, the pace-tail note).
 *
 * WHERE IT SITS
 *   Reached at the foreground loop's "pace tail" every frame a game is live (PLAY_FLAG 0x83fe non-zero).
 *   The tail runs this pass and then stays parked at the tail; the vblank NMI, not this code, advances the
 *   world. Both exits are tail-calls back into the foreground driver — one via the next-life path, one via
 *   the pace-tail re-entry — so this routine never "returns" a value the caller inspects.
 *
 * LIVE-OUT
 *   Memory only. It latches BOARD_LAYOUT_GATE (0x83ea), stamps HUD / time-bar / lives VRAM through its
 *   callees, clears BOARD_ADVANCE_REQUEST (0x826d) and mirrors the demo flag into PER_PLAYER_RESET_CELL
 *   (0x83b6). It leaves no register the caller reads; its return value is only whichever tail-callee's
 *   coroutine hand-off it forwards.
 */
import { BOARD_LAYOUT_GATE, FROG_STATE_DEMO_FLAG, PLAY_FLAG, BOARD_ADVANCE_REQUEST, PER_PLAYER_RESET_CELL, HUD_STAMP_BASE } from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { beginNextLifeOrIntro } from "./beginNextLifeOrIntro.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { swapInActivePlayerPages } from "./swapInActivePlayerPages.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { advanceBoardForeground } from "./advanceBoardForeground.js";
import { renderTimeBar } from "./renderTimeBar.js";
import { raiseActivePlayerStartFlag } from "./raiseActivePlayerStartFlag.js";
import { renderLivesRow } from "./renderLivesRow.js";
import { renderFrogSceneAndTickTimer } from "./renderFrogSceneAndTickTimer.js";

// PLAY_FLAG (0x83fe) is BOTH the in-play flag and the player count: 0 = attract, 1 = a one-player game,
// 2 = a two-player game. Because this dispatcher only runs when a game is live, "PLAY_FLAG !== ONE_PLAYER"
// reads in practice as "this is the two-player game" — the branch that needs per-player page banking.
const ONE_PLAYER = 1;

export function setUpBoardOrContinueLife(m) {
  const { mem8 } = m;

  // ── Fork on the layout latch: fresh board, or between-lives continue? ─────────────────
  // BOARD_LAYOUT_GATE (0x83ea) is the "board is laid out" latch. It is CLEARED to 0 to request a fresh
  // layout (new-life, board-complete, boot) and this routine SETS it to 1 once the board is drawn (below).
  // So a non-zero gate means the playfield already exists and this frame is a between-lives frame: tail-hand
  // to the continue / next-life path beginNextLifeOrIntro (ROM 0x0457), which redraws the header and either
  // re-activates the frog or, when no life remains, runs the intro / game-over branch. Nothing more to do
  // here — its coroutine hand-off is forwarded straight through as our return value.
  if (mem8[BOARD_LAYOUT_GATE] !== 0) return beginNextLifeOrIntro(m);

  // ── Redraw the score header, and (two-player only) reset the playfield surface ────────
  // FROG_STATE_DEMO_FLAG (0x83cd) is the frog-state / demo gate. Outside the demo it is 0, and we redraw
  // the three-column score header via renderScoreHeader (ROM 0x0b1f: HI-SCORE, 1-UP, and — for a 2P game —
  // 2-UP columns). During the attract demo the header is left alone.
  //   The tilemap wipe + page swap is guarded a second time on player count: only a two-player game needs
  // to blank the whole 32x32 tilemap to the empty tile (clearTilemapToTile16, ROM 0x0038, fills 0xa800..
  // 0xabff with tile 0x10) and bank the active player's work/object pages into the live pages
  // (swapInActivePlayerPages, ROM 0x06ee). A one-player game reuses the surface in place, so it skips both.
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    if (mem8[PLAY_FLAG] !== ONE_PLAYER) {
      clearTilemapToTile16(m);
      swapInActivePlayerPages(m);
    }
    renderScoreHeader(m);
  }

  // ── If a board-complete is pending, run the board-advance foreground ──────────────────
  // BOARD_ADVANCE_REQUEST (0x826d) is raised to 1 by loc_05d3 when all five frogs reach home. When set, we
  // run the once-per-board advance pass advanceBoardForeground (ROM 0x05f0): it queues the fanfare cues,
  // bumps the active player's difficulty index (wrapping at 5), reseeds the field, reloads the new board's
  // lane parameters, and adds the board-advance score bonus. The request cell is cleared later, below.
  if (mem8[BOARD_ADVANCE_REQUEST] !== 0) advanceBoardForeground(m);

  // ── Build the frog scene, and latch the layout gate from its result ───────────────────
  // renderFrogSceneAndTickTimer (ROM 0x0942) is the per-frame scene core: it paints the frog-scene
  // furniture, lays the status row and home markers, and ticks the active player's timer. It returns (in A)
  // the frog-object reset routine's ready value. We store that returned value straight into
  // BOARD_LAYOUT_GATE (0x83ea): once the board has been drawn this value is non-zero, so the gate LATCHES
  // set — and next frame the fork at the top takes the continue path instead of rebuilding the board.
  mem8[BOARD_LAYOUT_GATE] = renderFrogSceneAndTickTimer(m);

  // ── Redraw the column-30 time indicator ───────────────────────────────────────────────
  // renderTimeBar (ROM 0x0a16) draws the column-30 time indicator (tile 0x4d stacked up VRAM column 0xabbe
  // from the active player's time-remaining count). This is the narrow col-30 indicator, distinct from the
  // main draining green time bar.
  renderTimeBar(m);

  // ── Stamp the three fixed board-start HUD cells ───────────────────────────────────────
  // HUD_STAMP_BASE (0x839c) [code] is the base of a three-cell board-start HUD block. Three fixed tile
  // codes are written into cells +0..+2 at board start. The order below (+2, then +1, then +0) mirrors the
  // ROM's own store sequence; the cells are independent so the order is not observable, but it is kept
  // identical to the oracle. (These cells are code-level — their individual meaning is MAME-grounding
  // pending — so they are stamped by value, not by a named tile role.)
  mem8[HUD_STAMP_BASE + 2] = 0x20;
  mem8[HUD_STAMP_BASE + 1] = 0x10;
  mem8[HUD_STAMP_BASE] = 0x20;

  // ── Two-player: raise the active player's start flag ──────────────────────────────────
  // For a two-player game, raise TWO_PLAYER_START_FLAG for the active player via raiseActivePlayerStartFlag
  // (ROM 0x07c1): player 1 goes through the guarded helper (which only raises the flag while a board-advance
  // is still pending), any other active player writes the flag directly. A one-player game has no second
  // player to start, so it skips this.
  if (mem8[PLAY_FLAG] !== ONE_PLAYER) raiseActivePlayerStartFlag(m);

  // ── Consume the advance request; mirror the demo flag ─────────────────────────────────
  // Now clear BOARD_ADVANCE_REQUEST (0x826d) back to 0 — the advance foreground above (if any) has run, so
  // the request is spent. Then copy FROG_STATE_DEMO_FLAG (0x83cd) into PER_PLAYER_RESET_CELL (0x83b6): the
  // per-player reset cell is snapshotted to the current demo/frog-state value so the player hand-off path
  // sees a consistent reset state.
  mem8[BOARD_ADVANCE_REQUEST] = 0;
  mem8[PER_PLAYER_RESET_CELL] = mem8[FROG_STATE_DEMO_FLAG];

  // ── Redraw the lives / level row ──────────────────────────────────────────────────────
  // renderLivesRow (ROM 0x0a48) draws the lives column: up to 15 copies of marker tile 0x4c stepping down
  // VRAM column 0xa87e, one per remaining life.
  renderLivesRow(m);

  // ── Tail-enter the play loop at the pace-tail re-entry ────────────────────────────────
  // endForegroundPassAtPaceTail (ROM 0x0368) is the foreground main loop's pace-tail re-entry. As a
  // coroutine it runs nothing itself; it hands control back to the driver, which decides when the frame's
  // foreground pass is done and yields to the next vblank. We tail-return it so its iterator hand-off passes
  // straight through to our caller.
  return endForegroundPassAtPaceTail(m);
}
