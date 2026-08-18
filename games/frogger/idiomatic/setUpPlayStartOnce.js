// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayStartOnce  —  ROM 0x230f  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The once-per-life "raise the curtain" for a play session. When a life begins, the board is empty:
 *   no display field, no score field, no lane parameters, no frog. This routine draws all of it in a
 *   single linear pass — display field, score field, the active player's lane layout, the frog and its
 *   surrounding object tiles, the status row, the frog object itself, and the first frog-animation
 *   frame — then latches itself off so none of that redraws until the next life.
 *
 * WHERE IT SITS
 *   Called from the foreground main loop's head-work, every foreground pass (mechanisms.md: the head runs
 *   dispatchGameModeFrame, renderScoreHeader, renderCreditLine, then setUpPlayStartOnce). That matters:
 *   the foreground body can run TWICE between two vblank interrupts, and the emulation model relies on the
 *   body being idempotent — writing only constants and re-derived state, so a second pass reproduces the
 *   same RAM. A full board layout is NOT naturally idempotent (it would redraw and re-plot), so this
 *   routine guards itself with a one-shot latch (INTRO_COUNTER_829B, gate 2 below): the first pass of a
 *   life does the work and raises the latch; every later pass falls straight out the top. That latch is
 *   exactly what makes the foreground's second drain pass a no-op for this routine.
 *
 *   The latch it raises, INTRO_COUNTER_829B (0x829b), is also the run flag that gates the per-frame in-play
 *   engine driveInPlayFrameUpdate (0x2341) — which runs only once GAME_MODE == 1 AND this flag is set. So
 *   raising it at the end is the hand-off: "board is laid, real play may now proceed."
 *
 * LIVE-OUT
 *   Memory only (RAM flags + VRAM tiles, via the seven sub-routines it calls). It returns nothing and
 *   leaves no register the caller reads.
 */
import { GAME_MODE, INTRO_COUNTER_829B, CREDIT_COLUMN_CLEAR_LATCH, TWO_PLAYER_START_FLAG, STATUS_ROW_VRAM_BASE } from "./names.js";
import { initDisplayFieldOnce } from "./initDisplayFieldOnce.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { resetFrogObject } from "./resetFrogObject.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

// GAME_MODE (0x83d6) value for active play. The top-level mode byte reads 0 through attract and 1 while a
// game is actually being played; only mode 1 should trigger the board layout.
const MODE_ACTIVE_PLAY = 1;

export function setUpPlayStartOnce(m) {
  const { mem8 } = m;

  // ── Gate 1: are we actually in play? ─────────────────────────────────────────────────
  // GAME_MODE (0x83d6) is the top-level mode byte. Anything other than 1 (attract, intro, score-ranking,
  // player-select) has no board to lay out, so bail immediately.
  if (mem8[GAME_MODE] !== MODE_ACTIVE_PLAY) return;

  // ── Gate 2: has the layout already run this life? ────────────────────────────────────
  // INTRO_COUNTER_829B (0x829b) is the one-shot latch / run flag. renderMode2IntroScreen (0x2d88) zeroes it
  // when a fresh life's intro is built; this routine raises it to 1 at the very end. So a 0 here means
  // "board not yet drawn this life" (do the work), and a nonzero means "already drawn" (fall out). This is
  // the guard that makes the foreground's possible double-pass harmless.
  if (mem8[INTRO_COUNTER_829B] !== 0) return;

  // ── Re-arm the credit-column clear ───────────────────────────────────────────────────
  // CREDIT_COLUMN_CLEAR_LATCH (0x83b4) is renderCreditLine's (0x0b67) "already cleared the credit column"
  // latch: set to 1 after the column is wiped once, then checked to skip the wipe thereafter. Zeroing it
  // here re-arms that one-time clear, so the next time the CREDIT line is redrawn its column is wiped fresh.
  mem8[CREDIT_COLUMN_CLEAR_LATCH] = 0;

  // ── Lay out the static field ─────────────────────────────────────────────────────────
  // initDisplayFieldOnce (0x0aba): one-shot display-field layout (its own internal loc_842d guard makes it
  // idempotent) — blits the setup strip and fills the layout column.
  initDisplayFieldOnce(m);
  // clearAndSeedScoreField (0x0629): reset the score field for a new board — clears the active player's work
  // RAM, zeros the score-display cursor, and tiles the blank score field.
  clearAndSeedScoreField(m);
  // loadActivePlayerLaneParams (0x223d): copy this board's lane layout — follows the difficulty-indexed
  // pointer table LANE_PARAM_PTR_TABLE (0x2260) and copies 33 bytes into ACTIVE_LANE_PARAM_BLOCK (0x8270).
  loadActivePlayerLaneParams(m);

  // ── Enable frog plotting for the init render ─────────────────────────────────────────
  // TWO_PLAYER_START_FLAG (0x825b) doubles as a plot-suppression flag: renderFrogAnimTileColumns (0x0ff1)
  // skips its IY plot-cursor bump while this flag is NONZERO. Clearing it to 0 here lets the board-init frog
  // render below actually plot the frog's columns; it is raised again after the render so subsequent
  // per-frame animation arms don't re-plot.
  mem8[TWO_PLAYER_START_FLAG] = 0;

  // renderFrogAndArmObjects (0x1952): board-init frog/object render — copies the frog tile groups down VRAM,
  // stamps the surrounding box/banner, and raises the three object-ready flags.
  renderFrogAndArmObjects(m);
  // blitFourTileGroupColumn (0x19e2): paint the status row — a 14-row VRAM column of the 4-tile group
  // (tiles 72/73/74/75) starting at STATUS_ROW_VRAM_BASE (0xa850), passed as the caller-supplied base.
  blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE);
  // resetFrogObject (0x09aa): reset the live frog object — writes the spawn bytes (128,30,3,224) into the
  // FROG_X (0x8044) block, clears the demo/arrival cells, and raises FROG_READY_FLAG (0x83c3).
  resetFrogObject(m);

  // ── Draw the first frog-animation frame ──────────────────────────────────────────────
  // dispatchFrogAnimationArm (0x0faf) reads the anim-index cell (0x8000) and renders that arm's tile
  // columns, giving the freshly-spawned frog its starting sprite. In the ROM this ran under a BALANCED
  // push16(0x2338) + m.call: the pushed sentinel 0x2338 is this function's own continuation (the code just
  // below), and the arm cluster's single net `ret` pops it to land there. Dissolving the seam to a direct
  // call is exact — dropping the push only touches dead stack scratch in [0x87e0,0x8800).
  dispatchFrogAnimationArm(m);

  // ── Latch off: layout done, hand off to per-frame play ───────────────────────────────
  // Raise TWO_PLAYER_START_FLAG (0x825b) so later per-frame anim renders suppress their plot bump (see the
  // clear above), then set the run flag INTRO_COUNTER_829B (0x829b) = 1. Raising the run flag both closes
  // gate 2 (this whole layout fires exactly once per life) and opens driveInPlayFrameUpdate (0x2341), which
  // runs the in-play per-frame cascade only once this flag is set.
  mem8[TWO_PLAYER_START_FLAG] = 1;
  mem8[INTRO_COUNTER_829B] = 1;
}
