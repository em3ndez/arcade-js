// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreDigits — repaint the active player's on-screen score digits.  ROM 0x46af.
 *
 * The player's running score is held as two packed binary-coded-decimal bytes —
 * a low pair at 0x8031 and a high pair at 0x8034 — kept up to date by the scorer
 * (which tail-jumps straight here after each award). This routine splits those two
 * bytes into their four decimal digits and stamps each into its own cell of the
 * player's score column in the tile map:
 *   - which column depends on the active player — player 1 gets one column base,
 *     any other player the other (the HUD-redraw caller sweeps player 1 then 2);
 *   - within the column the cells step by one tile-map row (32 cells) each, with
 *     the most significant digit at the far cell and the least significant nearest
 *     the base.
 *
 * The low pair (0x8031) is drawn straight — the two lower-order digits are always
 * shown. The high pair (0x8034) is the leading pair and gets leading-zero blanking:
 * a zero most-significant digit is drawn as the blank tile instead of a "0", and
 * the second digit is blanked too only when the whole high pair is zero (once the
 * leading digit is present, a zero after it is a real "0" and stays).
 *
 * The score-column base is handed back to the caller (it reads it to blank the two
 * cells just above the score), so it is a genuine live-out.
 *
 * Memory-equivalent to the frozen oracle — equivalence-46af.test.js.
 * GATE:     real boot dispatches (all-zero attract score, both player columns) +
 *           exhaustive over every (player∈{1,2}, low byte, high byte) — all 131,072
 *           input combinations, covering both column bases and every blanking arm —
 *           on the four written cells + the returned column base; plus a whole-RAM /
 *           pc / SP contract check proving nothing outside those cells is touched.
 *           Teeth: a twin that never blanks the leading zero.
 * LIVE-OUT: memory (the four digit cells) + the score-column base register the
 *           still-oracle HUD-redraw caller reads back. The scratch digit/flag state
 *           the oracle leaves behind is dead — its other callers invoke it only for
 *           the repaint side effect and read none of it.
 * NAMES:    GAME_STATE2 (0x8002) — read here as the active player index. 0x8031 /
 *           0x8034 kept hex: the packed BCD score low / high bytes, not yet named in
 *           ram.js. The two column bases are tile-map addresses (hex).
 */

import { GAME_STATE2 } from "./ram.js";

// The blank tile that replaces a suppressed leading zero.
const BLANK_TILE = 36;

// Tile-map bases of the two players' score columns, and the per-digit row stride.
const P1_SCORE_COLUMN = 0x9301;
const OTHER_SCORE_COLUMN = 0x90c1;
const ROW = 32; // one tile-map row down the column

export function drawScoreDigits(m) {
  const { regs, mem } = m;

  // Active player picks which score column to repaint.
  const base = mem.read8(GAME_STATE2) === 1 ? P1_SCORE_COLUMN : OTHER_SCORE_COLUMN;

  // Low pair: the two lower-order digits, always drawn (no blanking).
  const low = mem.read8(0x8031);
  mem.write8(base, low & 0x0f); // least significant digit
  mem.write8(base + ROW, low >> 4); // next digit up

  // High pair: the two leading digits, with leading-zero blanking.
  const high = mem.read8(0x8034);
  const leadDigit = high >> 4;
  const secondDigit = high & 0x0f;

  // Most significant digit: a zero here is a leading zero, so blank it.
  mem.write8(base + 3 * ROW, leadDigit === 0 ? BLANK_TILE : leadDigit);

  // Second digit: blank it only when the whole high pair is zero; otherwise a zero
  // here follows a shown leading digit and is a genuine "0".
  const secondCell = secondDigit === 0 && leadDigit === 0 ? BLANK_TILE : secondDigit;
  mem.write8(base + 2 * ROW, secondCell);

  // Hand the column base back — the HUD-redraw caller reads it to blank the cells above.
  regs.ix = base;
}
