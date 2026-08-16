// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchGameModeFrame — the per-frame intro/attract mode state machine. Returns while the frame
 * pacing timer is still running; then dispatches on the mode byte: mode 3 draws the
 * score-ranking screen, a non-zero credit/in-play gate enters the in-play board init, mode 4
 * the point-table phase, mode 2 the intro screen. Any other mode returns, except mode 5, which falls
 * into the reset arm: reseed the pacing timer, clear the sub-phase and a scratch cell, blit a strip, and
 * tail into the shared final-strip tail (kept dispatch). LIVE-OUT: memory-only.
 */
import { POINT_TABLE_DRAW_STATE, GAME_MODE, CREDIT_BCD, ATTRACT_DEMO_PHASE_COUNTER } from "./names.js";
import { renderMode3ScoreRankingScreen } from "./renderMode3ScoreRankingScreen.js";
import { initInPlayBoardOnce } from "./initInPlayBoardOnce.js";
import { renderMode4PointTablePhase } from "./renderMode4PointTablePhase.js";
import { renderMode2IntroScreen } from "./renderMode2IntroScreen.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

const MODE_SCORE_RANKING = 3, MODE_POINT_TABLE = 4, MODE_INTRO = 2, MODE_RESET = 5;
const TIMER_RELOAD = 0x30;
const RESET_STRIP_DST = 0xaaca, RESET_STRIP_SRC = 0x2f01, RESET_STRIP_LEN = 0x0d;
const loc_8015 = 0x8015;         // cleared with the sub-phase on the mode-5 reset arm
const FINAL_STRIP_TAIL = 0x0c17; // shared final-strip tail (kept m.call, dispatched through the map)

export function dispatchGameModeFrame(m) {
  const { mem8 } = m;

  if (mem8[POINT_TABLE_DRAW_STATE] !== 0) return;

  if (mem8[GAME_MODE] === MODE_SCORE_RANKING) return renderMode3ScoreRankingScreen(m);
  if (mem8[CREDIT_BCD] !== 0) return initInPlayBoardOnce(m);
  if (mem8[GAME_MODE] === MODE_POINT_TABLE) return renderMode4PointTablePhase(m);
  if (mem8[GAME_MODE] === MODE_INTRO) return renderMode2IntroScreen(m);
  if (mem8[GAME_MODE] !== MODE_RESET) return;

  mem8[POINT_TABLE_DRAW_STATE] = TIMER_RELOAD;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[loc_8015] = 0;
  copyRunUpTileColumn(m, RESET_STRIP_DST, RESET_STRIP_SRC, RESET_STRIP_LEN);
  return m.call(FINAL_STRIP_TAIL);
}
