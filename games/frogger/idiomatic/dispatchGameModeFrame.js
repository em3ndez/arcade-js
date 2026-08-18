// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchGameModeFrame  —  ROM 0x0d11  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The intro/attract "which screen am I on this frame?" state machine. Frogger is not playing a game
 *   during attract mode — it is cycling through a slideshow: the SCORE RANKING (high-score) board, the
 *   POINT TABLE, and the title/intro screen. GAME_MODE (0x83d6) is the slide number, and this routine
 *   runs once per frame to draw whichever slide is currently selected, or — when the coin logic has
 *   parked the machine in the coin/reset mode — to reset the pacing gate and hand off to the shared
 *   score-ranking tail so the slideshow restarts.
 *
 * WHERE IT SITS
 *   Called from the main loop's foreground pass (runOneForegroundPass, inside loc_0341 / MAIN_LOOP_HEAD
 *   0x0341) and only while GAME_MODE >= 2 —
 *   i.e. an intro/attract slide, never during live play or the raw attract demo (modes 0 and 1 are
 *   handled elsewhere and never reach here). It is gated hard at the top by the frame-pacing counter, so
 *   on the great majority of frames it returns immediately without drawing anything: a slide is drawn
 *   only on the one frame per pacing interval when that counter has drained to zero.
 *
 * LIVE-OUT
 *   Memory only. Every arm either tail-calls a screen builder (which writes VRAM and attract work cells)
 *   or, in the reset arm, writes four cells and tail-calls the shared final-strip blit. It returns
 *   nothing and leaves no register the caller reads.
 */
import { POINT_TABLE_DRAW_STATE, GAME_MODE, CREDIT_BCD, ATTRACT_DEMO_PHASE_COUNTER, RESET_STRIP_VRAM, RESET_STRIP_SRC, OBJECT_ANIM_STATE_8015 } from "./names.js";
import { renderMode3ScoreRankingScreen } from "./renderMode3ScoreRankingScreen.js";
import { initInPlayBoardOnce } from "./initInPlayBoardOnce.js";
import { renderMode4PointTablePhase } from "./renderMode4PointTablePhase.js";
import { renderMode2IntroScreen } from "./renderMode2IntroScreen.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { blitMode3FinalStrip } from "./blitMode3FinalStrip.js";

// GAME_MODE (0x83d6) slide numbers. The numeric values are what the ROM's compares test; the human
// labels are read off the [seen]-grounded screen builders each number dispatches to. Mode 5 is grounded
// as the coin/player-select mode (setAttractIdleMode forces GAME_MODE = 5); the 2..4 slide labels are
// inferred from their builders' contents. Modes 0 and 1 never arrive here (this routine runs only while
// GAME_MODE >= 2), which is why there is no arm for them.
const MODE_SCORE_RANKING = 3, MODE_POINT_TABLE = 4, MODE_INTRO = 2, MODE_RESET = 5;

// Value re-seeded into the pacing/drawn-state gate POINT_TABLE_DRAW_STATE (0x83d8) on the mode-5 reset,
// restarting the ~0x30-frame countdown that paces the slideshow (see the top-of-frame gate below).
const PACING_GATE_RELOAD = 0x30;

// Length of the mode-5 reset-arm tile strip: 13 tiles copied up VRAM column RESET_STRIP_VRAM (0xaaca)
// from ROM source RESET_STRIP_SRC (0x2f01). Matches both cells' 13-tile role in names.js.
const RESET_STRIP_LEN = 0x0d;

export function dispatchGameModeFrame(m) {
  const { mem8 } = m;

  // ── Frame-pacing gate ────────────────────────────────────────────────────────────────
  // POINT_TABLE_DRAW_STATE (0x83d8) is the attract slideshow's pacing / already-drawn gate. It is
  // decremented elsewhere each frame; while it is still nonzero the current slide is mid-dwell (or
  // already drawn), so this frame does nothing. Only when it reaches 0 do we fall through and (re)draw.
  if (mem8[POINT_TABLE_DRAW_STATE] !== 0) return;

  // The rest of the routine is a priority ladder over the slide number and the coin state. The FIRST
  // arm that matches tail-calls its builder and returns; order matters (score-ranking outranks the
  // coin gate, which outranks the remaining slides).

  // ── Mode 3: SCORE RANKING board ────────────────────────────────────────────────────────
  // Draw the high-score ranking screen (FROGGER logo, five ranked scores, KONAMI 1981). The builder
  // also steps the pacing gate and falls through into blitMode3FinalStrip on its own.
  if (mem8[GAME_MODE] === MODE_SCORE_RANKING) return renderMode3ScoreRankingScreen(m);

  // ── Coin queued → begin the game ───────────────────────────────────────────────────────
  // CREDIT_BCD (0x83e1) is the packed-BCD on-screen credit total; nonzero means a coin has been
  // credited but the board is not laid yet. Regardless of which attract slide we were on, a queued
  // credit diverts to the once-per-board in-play setup, starting the real game.
  if (mem8[CREDIT_BCD] !== 0) return initInPlayBoardOnce(m);

  // ── Mode 4: POINT TABLE ────────────────────────────────────────────────────────────────
  // Draw one phase per call of the "-POINT TABLE-" screen (10 pts per step, 50 per home, 1000 for five
  // frogs). The builder cycles its own sub-phases via ATTRACT_DEMO_PHASE_COUNTER (0x83d7).
  if (mem8[GAME_MODE] === MODE_POINT_TABLE) return renderMode4PointTablePhase(m);

  // ── Mode 2: title / intro screen ───────────────────────────────────────────────────────
  // Build the intro screen (title strip, intro counters seeded).
  if (mem8[GAME_MODE] === MODE_INTRO) return renderMode2IntroScreen(m);

  // ── Any other mode except reset → nothing to draw ──────────────────────────────────────
  // Only mode 5 (the coin/player-select reset mode) has work left below. Every other value the gate
  // let through is a no-op this frame.
  if (mem8[GAME_MODE] !== MODE_RESET) return;

  // ── Mode 5: reset arm — restart the attract slideshow ──────────────────────────────────
  // Reseed the pacing gate so the countdown begins again; clear the slideshow's sub-phase counter
  // ATTRACT_DEMO_PHASE_COUNTER (0x83d7) and the object-animation scratch cell OBJECT_ANIM_STATE_8015
  // (0x8015) so the next slide starts from a clean slate.
  mem8[POINT_TABLE_DRAW_STATE] = PACING_GATE_RELOAD;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[OBJECT_ANIM_STATE_8015] = 0;

  // Blit the 13-tile reset strip up VRAM column RESET_STRIP_VRAM (0xaaca) from ROM RESET_STRIP_SRC
  // (0x2f01), then tail into blitMode3FinalStrip (0x0c17) — the shared SCORE RANKING final-strip tail —
  // so the machine lands back at the top of the score-ranking slide.
  copyRunUpTileColumn(m, RESET_STRIP_VRAM, RESET_STRIP_SRC, RESET_STRIP_LEN);
  return blitMode3FinalStrip(m);
}
