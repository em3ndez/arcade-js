// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoDigitField — place a two-digit number's tile pair into the bonus readout field: the
 * high-digit tile (from the accumulator) into the higher-address cell first, then the low-digit
 * tile into the cell one screen column earlier (the two cells are 32 apart).
 *
 * LIVE-OUT: memory-only — the two tilemap cells.
 */

const HIGH_DIGIT_CELL = 0x74e6;
const LOW_DIGIT_CELL = 0x74c6;

export function stampTwoDigitField(m, a = m.regs.a, b = m.regs.b) {
  const { regs, mem8 } = m;

  mem8[HIGH_DIGIT_CELL] = a;
  regs.a = b;
  mem8[LOW_DIGIT_CELL] = regs.a;
}
