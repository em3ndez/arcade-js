// SPDX-License-Identifier: GPL-3.0-only
import {
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_BCD,
  P1_SCORE_VRAM,
  P2_SCORE_VRAM,
  HIGH_SCORE_VRAM,
} from "./names.js";
import { renderDigitWithBlanking } from "./renderDigitWithBlanking.js";
/**
 * loc_0552 — reset one of three 3-byte BCD counters to zero and repaint it in its HUD column.
 *
 * A selects the counter (0 = player 1, 1 = player 2, else high score): its three bytes are zeroed,
 * then rendered most-significant byte first down the column, each byte split into a high then a low
 * BCD digit through the leading-zero-blanking digit painter (blank budget 4, one row up per digit).
 * Since the bytes were just zeroed, the first four digits paint as blanks and the last two as zeros.
 *
 * LIVE-OUT: none (memory only) — the cleared counter and the repainted HUD column.
 */
const COUNTER_BYTES = 3;
const BLANK_BUDGET = 4; //     leading zeros suppressed before a real 0 shows
const ROW_STRIDE_UP = -0x20; // one tilemap row up between stacked digits

export function loc_0552(m, sel = m.regs.a) {
  const { mem8 } = m;

  const base = sel === 0 ? P1_SCORE_BCD : sel === 1 ? P2_SCORE_BCD : HIGH_SCORE_BCD;
  const dest = sel === 0 ? P1_SCORE_VRAM : sel === 1 ? P2_SCORE_VRAM : HIGH_SCORE_VRAM;

  mem8[base] = 0;
  mem8[base + 1] = 0;
  mem8[base + 2] = 0;

  let cursor = dest;
  let budget = BLANK_BUDGET;
  let src = base + COUNTER_BYTES - 1; // top byte, read downward
  for (let i = 0; i < COUNTER_BYTES; i++) {
    const byte = mem8[src];
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_STRIDE_UP, byte >> 4, budget);
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_STRIDE_UP, byte, budget);
    src -= 1;
  }
}
