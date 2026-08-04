// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoDigitField — stamp a two-digit number's tile pair into its on-screen field: the
 * high-digit tile into one cell, the low-digit tile into the cell one column over.
 *
 * The field is the two-digit bonus readout. Its writer holds the quantity as a packed-BCD byte
 * and splits it into a high-digit tile and a low-digit tile; both of that writer's arms — the
 * ordinary one, and the leading-zero-suppress arm that enters with the high tile forced to a
 * blank — funnel through this shared tail to place the pair. Only the tile VALUES the arms
 * bring differ; the two writes are the same.
 *
 * The high-digit tile arrives in the accumulator and is written FIRST, into the higher-address
 * cell; the low-digit tile follows into the cell one screen column earlier on the rotated
 * tilemap (the two cells are 32 apart). A straight-line leaf: no branch, no RAM read, calls
 * nothing.
 *
 * NOT CLAIMED: which cells of the visible screen these two addresses are has never been checked
 * against pixels.
 *
 * LIVE-OUT: memory-only — the two tilemap cells.
 */

// The two cells of the display field, one screen column apart on the rotated tilemap.
const HIGH_DIGIT_CELL = 0x74e6; // written first
const LOW_DIGIT_CELL = 0x74c6;

export function stampTwoDigitField(m) {
  const { regs, mem } = m;

  // High-digit tile into the high cell, then the low-digit tile into the low cell.
  mem.write8(HIGH_DIGIT_CELL, regs.a);
  regs.a = regs.b;
  mem.write8(LOW_DIGIT_CELL, regs.a);
}
