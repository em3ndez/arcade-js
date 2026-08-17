// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitPlayerSelectPrompt — queue the player-select prompt tiles. With one credit, the "ONE PLAYER ONLY"
 * prompt (4-tile then 11-tile column from a second source); otherwise set the screen state, the "ONE OR
 * TWO PLAYERS" prompt (4-tile then 13-tile), and cap the advanced cursor. LIVE-OUT: memory-only.
 */
import { CREDIT_BCD, SCREEN_MODE_STATE, PLAYER_SELECT_PROMPT_SRC, PLAYER_SELECT_PROMPT_1CREDIT_SRC, ONE_PLAYER_ONLY_PROMPT_VRAM, ONE_OR_TWO_PLAYERS_PROMPT_VRAM } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

const ONE_CREDIT = 1;
const SCREEN_STATE = 3;
const CURSOR_CAP_TILE = 35;

export function blitPlayerSelectPrompt(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_BCD] === ONE_CREDIT) return blitOnePlayerOnly(m);

  mem8[SCREEN_MODE_STATE] = SCREEN_STATE;
  copyRunUpTileColumn(m, ONE_OR_TWO_PLAYERS_PROMPT_VRAM, PLAYER_SELECT_PROMPT_SRC, 4);
  copyRunUpTileColumn(m, undefined, undefined, 13);
  mem8[m.regs.hl] = CURSOR_CAP_TILE;
}

// The one-credit prompt: two columns, the second from a second tile source; no cursor cap.
function blitOnePlayerOnly(m) {
  copyRunUpTileColumn(m, ONE_PLAYER_ONLY_PROMPT_VRAM, PLAYER_SELECT_PROMPT_SRC, 4);
  copyRunUpTileColumn(m, undefined, PLAYER_SELECT_PROMPT_1CREDIT_SRC, 11);
}
