// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpBoardOrContinueLife — the board-start / life-loss dispatcher. When the continue flag
 * is set a life remains, so it tail-hands to the continue/next-life path (beginNextLifeOrIntro).
 * Otherwise it lays out a fresh board: for a 2-player game with no swap pending it clears the tilemap
 * and swaps in the active player's pages, redraws the score header, runs the extra-life foreground when
 * a request is pending, builds the board (kept dispatch), redraws the time bar, stamps
 * the three board-start HUD cells, raises the 2-player start flag, clears the request cell, mirrors the
 * demo flag, redraws the lives row, then tail-enters the play loop. LIVE-OUT: memory-only.
 */
import { loc_83ea, FROG_STATE_DEMO_FLAG, PLAY_FLAG, TWO_PLAYER_MODE_FLAG, PER_PLAYER_RESET_CELL, PACE_TAIL } from "./names.js";
import { beginNextLifeOrIntro } from "./beginNextLifeOrIntro.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { swapInActivePlayerPages } from "./swapInActivePlayerPages.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { advanceBoardForeground } from "./advanceBoardForeground.js";
import { renderTimeBar } from "./renderTimeBar.js";
import { raiseActivePlayerStartFlag } from "./raiseActivePlayerStartFlag.js";
import { renderLivesRow } from "./renderLivesRow.js";

const ONE_PLAYER = 1;
const BUILD_BOARD = 0x0942, BUILD_BOARD_RET = 0x042f; // renderFrogSceneAndTickTimer (kept m.call via the map); returns the continue flag in A
const HUD_STAMP_BASE = 0x839c;                        // three board-start HUD cells, stamped 0x20/0x10/0x20

export function setUpBoardOrContinueLife(m) {
  const { regs, mem8 } = m;

  if (mem8[loc_83ea] !== 0) return beginNextLifeOrIntro(m);

  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    if (mem8[PLAY_FLAG] !== ONE_PLAYER) {
      clearTilemapToTile16(m);
      swapInActivePlayerPages(m);
    }
    renderScoreHeader(m);
  }

  if (mem8[TWO_PLAYER_MODE_FLAG] !== 0) advanceBoardForeground(m);

  m.push16(BUILD_BOARD_RET);
  m.call(BUILD_BOARD);
  mem8[loc_83ea] = regs.a;

  renderTimeBar(m);

  mem8[HUD_STAMP_BASE + 2] = 0x20;
  mem8[HUD_STAMP_BASE + 1] = 0x10;
  mem8[HUD_STAMP_BASE] = 0x20;

  if (mem8[PLAY_FLAG] !== ONE_PLAYER) raiseActivePlayerStartFlag(m);

  mem8[TWO_PLAYER_MODE_FLAG] = 0;
  mem8[PER_PLAYER_RESET_CELL] = mem8[FROG_STATE_DEMO_FLAG];

  renderLivesRow(m);

  return m.call(PACE_TAIL);
}
