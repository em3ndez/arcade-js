// SPDX-License-Identifier: GPL-3.0-only
/**
 * redrawScoreHud — repaint both players' on-screen score displays, draw the status label, and
 * tint the two HUD colour columns.
 *
 * The score-HUD refresh, invoked from the title/round-transition redraw. For player 1 then
 * player 2 it copies that player's saved state into the shared display slot, repaints the four
 * score digits, and blanks the two cells directly above that player's score column. It then
 * reselects the active player and re-copies its state so later HUD work sees the live player.
 * From the player count it draws the status label: one or two players get the in-game panel, any
 * other count (no players, or three or more) the "GAME OVER" label. Finally it tints colour 2 up
 * two HUD colour columns, bottom cell upward, one screen row apart — nine cells then ten.
 */

import { drawScoreDigits } from "./drawScoreDigits.js";
import { drawGameOverLabel } from "./drawGameOverLabel.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { loadPlayerState } from "./loadPlayerState.js";
import { ACTIVE_PLAYER, GAME_STATE, SCORE_HUD_COLOUR_LOWER_BOTTOM, SCORE_HUD_COLOUR_UPPER_BOTTOM } from "./names.js";

// One screen row = 32 cells across the 32-wide tile/colour map.
const ROW = 32;

// The status label is picked from the player count: one or two players get the
// in-game panel, any other count the "GAME OVER" label.
const HUD_COLOUR = 2;
const FIRST_COLUMN_BOTTOM = SCORE_HUD_COLOUR_LOWER_BOTTOM;
const FIRST_COLUMN_CELLS = 9;
const SECOND_COLUMN_BOTTOM = SCORE_HUD_COLOUR_UPPER_BOTTOM;
const SECOND_COLUMN_CELLS = 10;

export function redrawScoreHud(m) {
  const { mem8 } = m;

  // Remember the active player; the per-player sweep reselects each slot in turn.
  const activePlayer = mem8[ACTIVE_PLAYER];

  // Player 1 then player 2: refresh the score column and clear the cells above it.
  for (const player of [1, 2]) {
    mem8[ACTIVE_PLAYER] = player;
    loadPlayerState(m); // copy this player's saved state into the shared display slot
    const columnBase = drawScoreDigits(m); // repaint the four digits; returns the score-column base
    mem8[columnBase - ROW] = 0; // blank the cell one row above the score
    mem8[columnBase - 2 * ROW] = 0; // and the cell two rows above
  }

  // Reselect the active player and re-copy its state for the downstream HUD work.
  mem8[ACTIVE_PLAYER] = activePlayer;
  loadPlayerState(m);

  // Draw the status label from the player count. Each label routine tail-returns through the
  // balanced stack, so it is handed the return slot its caller would push for it.
  const players = mem8[GAME_STATE];
  if (players === 1 || players === 2) {
    drawPlayerLabel(m); // in-game status panel
  } else {
    drawGameOverLabel(m); // "GAME OVER" label
  }

  // Tint colour 2 up the two HUD colour columns, bottom cell upward, one row apart.
  let cell = FIRST_COLUMN_BOTTOM;
  for (let i = 0; i < FIRST_COLUMN_CELLS; i++) {
    mem8[cell] = HUD_COLOUR;
    cell -= ROW;
  }
  cell = SECOND_COLUMN_BOTTOM;
  for (let i = 0; i < SECOND_COLUMN_CELLS; i++) {
    mem8[cell] = HUD_COLOUR;
    cell -= ROW;
  }
}
