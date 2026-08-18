// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitPlayerSelectPrompt  —  ROM 0x0db9  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Paints the player-select prompt line on the attract/credit screen — the "ONE PLAYER ONLY" or
 *   "ONE OR TWO PLAYERS" text a player sees after dropping a coin, before a game starts. Which prompt it
 *   draws depends entirely on how many credits are banked: exactly one credit gets the terse
 *   single-player line (a lone credit can only ever buy a single-player game), while two or more offers
 *   the choice.
 *
 * WHERE IT SITS
 *   Called from two spots on the pre-game path. The coin scanner scanCoinInputAndCredit (0x2cf0) redraws
 *   it each time a coin lands while already in player-select mode, and the one-shot board setup
 *   initInPlayBoardOnce (0x0d4c) blits it while laying out a fresh board. It leans on the shared tilemap
 *   primitive copyRunUpTileColumn (RST 0x28, ROM 0x0028) to stamp each vertical column of glyph tiles.
 *
 * LIVE-OUT
 *   Memory only: the VRAM tile cells it writes, plus the SCREEN_MODE_STATE marker on the two-player arm.
 *   It returns nothing the caller reads.
 */
import { CREDIT_BCD, SCREEN_MODE_STATE, PLAYER_SELECT_PROMPT_SRC, PLAYER_SELECT_PROMPT_1CREDIT_SRC, ONE_PLAYER_ONLY_PROMPT_VRAM, ONE_OR_TWO_PLAYERS_PROMPT_VRAM } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

// Exactly one banked credit selects the single-player prompt. The ROM tests this by decrementing a copy
// of the credit count and branching on zero — i.e. the branch is taken iff credit == 1.
const ONE_CREDIT = 1;

// Written to SCREEN_MODE_STATE (0x8023) on the two-player arm: the header-state marker meaning "the
// one-or-two-player prompt is up". The one-credit arm never touches this cell.
const PROMPT_SCREEN_STATE = 3;

// Tile 0x23 ('S'), stamped as the final cell of the two-player line to finish "PLAYER" -> "PLAYERS".
const CURSOR_CAP_TILE = 35;

export function blitPlayerSelectPrompt(m) {
  const { mem8 } = m;

  // ── Which prompt? Branch on the banked credit count ──────────────────────────────────
  // CREDIT_BCD (0x83e1) is the on-screen credit total in packed BCD. With exactly one credit there is no
  // choice to offer, so paint "ONE PLAYER ONLY" and return.
  if (mem8[CREDIT_BCD] === ONE_CREDIT) return blitOnePlayerOnly(m);

  // ── Two-or-more-credits arm: "ONE OR TWO PLAYERS" ────────────────────────────────────
  // Mark the screen as showing the two-player prompt. SCREEN_MODE_STATE (0x8023) = 3 is the header-state
  // marker the rest of the select flow keys off; the one-credit arm above deliberately leaves it alone.
  mem8[SCREEN_MODE_STATE] = PROMPT_SCREEN_STATE;

  // Draw the line as two stacked tile columns, each stamped UP its column by copyRunUpTileColumn. First
  // column: 4 tiles from the shared prompt source PLAYER_SELECT_PROMPT_SRC (0x2f88) up the VRAM column
  // ONE_OR_TWO_PLAYERS_PROMPT_VRAM (0xab11). The helper hands back its walked source/destination pointers
  // so the next column can continue straight on from where this one stopped — no address recomputation.
  const firstColumn = copyRunUpTileColumn(m, ONE_OR_TWO_PLAYERS_PROMPT_VRAM, PLAYER_SELECT_PROMPT_SRC, 4);

  // Second column: 13 more tiles, resuming from the first column's advanced destination (hl) and source
  // (de) pointers. Together the two columns spell "ONE OR TWO PLAYER".
  const { hl } = copyRunUpTileColumn(m, firstColumn.hl, firstColumn.de, 13);

  // Cap the advanced destination cursor — the cell where copyRunUpTileColumn left hl after the second
  // column — with tile 0x23 ('S'), the trailing letter that turns "PLAYER" into "PLAYERS" so the line
  // reads "ONE OR TWO PLAYERS".
  mem8[hl] = CURSOR_CAP_TILE;
}

// The one-credit prompt: "ONE PLAYER ONLY", two stacked tile columns and no cursor cap — one credit can
// only buy a single-player game, so there is nothing to choose.
function blitOnePlayerOnly(m) {
  // First column: 4 tiles from the shared prompt source PLAYER_SELECT_PROMPT_SRC (0x2f88) up the VRAM
  // column ONE_PLAYER_ONLY_PROMPT_VRAM (0xaaf1). (In the ROM this source is loaded once, ahead of the
  // credit branch, so both arms draw their first column from the same 0x2f88 tile run.)
  const { hl } = copyRunUpTileColumn(m, ONE_PLAYER_ONLY_PROMPT_VRAM, PLAYER_SELECT_PROMPT_SRC, 4);

  // Second column: 11 tiles from the one-credit-only source PLAYER_SELECT_PROMPT_1CREDIT_SRC (0x2f93),
  // resuming up the same column from where the first stopped. This arm writes no cursor-cap tile.
  copyRunUpTileColumn(m, hl, PLAYER_SELECT_PROMPT_1CREDIT_SRC, 11);
}
