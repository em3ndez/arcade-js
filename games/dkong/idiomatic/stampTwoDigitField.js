import {
  BONUS_READOUT_LOW_DIGIT_CELL,
  TWO_DIGIT_FIELD_HIGH_CELL,
} from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoDigitField — place a two-digit number's tile pair into the bonus readout field: the
 * high-digit tile (from the accumulator) into the higher-address cell first, then the low-digit
 * tile into the cell one screen column earlier (the two cells are 32 apart).
 *
 * LIVE-OUT: memory-only — the two tilemap cells.
 */


export function stampTwoDigitField(m, a = m.regs.a, b = m.regs.b) {
  const { mem8 } = m;

  mem8[TWO_DIGIT_FIELD_HIGH_CELL] = a;
  mem8[BONUS_READOUT_LOW_DIGIT_CELL] = b;
}
