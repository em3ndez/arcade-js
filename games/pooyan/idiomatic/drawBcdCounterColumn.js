// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { renderDigitWithBlanking } from "./renderDigitWithBlanking.js";
import {
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_BCD_HI,
  P1_SCORE_VRAM,
  P2_SCORE_VRAM,
  HIGH_SCORE_VRAM,
} from "./names.js";
/**
 * drawBcdCounterColumn — draw one of three packed-BCD counters down a screen column.
 *
 * The selector (0/1/2) picks a counter's source bytes and its on-screen column. Each of the
 * three source bytes is split into its high then low digit and painted one cell apart up the
 * column, with leading zeros suppressed by a shared budget. Memory-only: it paints cells only.
 */

const ROW_UP = -0x20; // the per-digit column step, one tilemap row up
const DIGIT_BYTES = 3; // three source bytes per counter
const BLANK_BUDGET = 4; // leading-zero blanking budget seeded for the column

export function drawBcdCounterColumn(m, selector = m.regs.a) {
  const { mem8 } = m;

  let source, cursor;
  if (selector === 0) {
    source = P1_SCORE_BCD + 2;
    cursor = P1_SCORE_VRAM;
  } else if (selector === 1) {
    source = P2_SCORE_BCD + 2;
    cursor = P2_SCORE_VRAM;
  } else {
    source = HIGH_SCORE_BCD_HI;
    cursor = HIGH_SCORE_VRAM;
  }

  let budget = BLANK_BUDGET;
  let src = source;
  for (let i = 0; i < DIGIT_BYTES; i++) {
    const byte = mem8[src];
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_UP, (byte >> 4) & 0x0f, budget);
    [cursor, budget] = renderDigitWithBlanking(m, cursor, ROW_UP, byte & 0x0f, budget);
    src = u16(src - 1);
  }
}
