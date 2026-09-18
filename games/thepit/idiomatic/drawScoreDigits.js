// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreDigits — repaint the active player's on-screen score digits.
 *
 * The running score is two packed binary-coded-decimal bytes, SCORE_LO (low pair) and SCORE_HI
 * (high pair). This splits them into four decimal digits and stamps each into its own cell of the
 * active player's score column, one tile-map row apart. The low pair is always drawn; the high pair
 * gets leading-zero blanking — a zero lead digit shows as the blank tile, and the second digit
 * blanks too only when the whole high pair is zero. The column base is returned so the caller can
 * blank the two cells above the score.
 */

import { ACTIVE_PLAYER, SCORE_HI, SCORE_LO } from "./names.js";

// The blank tile that replaces a suppressed leading zero.
const BLANK_TILE = 36;

const P1_SCORE_COLUMN = 0x9301;
const OTHER_SCORE_COLUMN = 0x90c1;
const ROW = 32; // one tile-map row down the column

export function drawScoreDigits(m) {
  const { regs, mem8 } = m;

  // Active player picks which score column to repaint.
  const base = mem8[ACTIVE_PLAYER] === 1 ? P1_SCORE_COLUMN : OTHER_SCORE_COLUMN;

  const low = mem8[SCORE_LO];
  mem8[base] = low & 0x0f;
  mem8[base + ROW] = low >> 4;

  const high = mem8[SCORE_HI];
  const leadDigit = high >> 4;
  const secondDigit = high & 0x0f;

  // Most significant digit: a zero here is a leading zero, so blank it.
  mem8[base + 3 * ROW] = leadDigit === 0 ? BLANK_TILE : leadDigit;

  // Second digit: blank it only when the whole high pair is zero; otherwise a zero
  // here follows a shown leading digit and is a genuine "0".
  const secondCell = secondDigit === 0 && leadDigit === 0 ? BLANK_TILE : secondDigit;
  mem8[base + 2 * ROW] = secondCell;

  // Hand the column base back — the HUD-redraw caller reads it to blank the cells above.
  regs.ix = base;
}
