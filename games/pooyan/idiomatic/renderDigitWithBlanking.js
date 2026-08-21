// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * renderDigitWithBlanking — paint one number digit to the tile at the cursor, suppressing
 * leading zeros, then step the cursor by the row stride.
 *
 * A non-zero digit stores as-is and ends the leading-blank run (budget -> 0). A zero digit
 * stores the blank tile while the budget is non-zero (budget--), or a real 0 once the budget
 * is spent. A leaf: one tile write, calls nothing.
 *
 * LIVE-OUT: [next, blankBudget] — the advanced cursor (cursor+stride) and the remaining
 * blank budget; the caller threads both across the digits of a field, so the bridge writes back
 * IX (next) and C (blankBudget) while returning the tuple for idiomatic callers.
 */
const BLANK_TILE = 0x10;

export function renderDigitWithBlanking(m, cursor = m.regs.ix, stride = m.regs.de, digit = m.regs.a, blankBudget = m.regs.c) {
  const { mem8 } = m;

  const nibble = digit & 0x0f;
  let tile, budget;
  if (nibble !== 0) {
    tile = nibble; //              a real digit ends the leading-blank run
    budget = 0;
  } else if (blankBudget !== 0) {
    tile = BLANK_TILE; //          still blanking -> spend one blank
    budget = u8(blankBudget - 1);
  } else {
    tile = 0; //                   budget spent -> a genuine zero digit
    budget = 0;
  }

  mem8[cursor] = tile;
  return [m.regs.ix = u16(cursor + stride), m.regs.c = budget];
}
