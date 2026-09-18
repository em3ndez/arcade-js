// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColourColumnAt — paint a full-height colour-RAM column with one colour.
 * `columnOffset` picks the column (an offset into colour RAM from its top-of-column anchor) and
 * `colour` is the palette byte stamped into every cell; the column runs a fixed 28 cells down
 * (one screen row per step, 32 cells along the map), starting two rows below the colour-RAM base.
 * Before painting, the colour is recorded as the shared colour index so a following fill continues
 * from it — the fixed-height, arguments-in variant of the staged-cursor colour-column fill.
 */
export function fillColourColumnAt(m, columnOffset = m.regs.a, colour = m.regs.c) {
  const { mem8 } = m;

  // Record the colour as the shared colour index the sibling colour fills read.
  mem8[0x8057] = colour;

  // Top cell of the chosen column: the top-of-column anchor sits two rows below the base.
  let cell = 0x8840 + columnOffset;

  // Stamp the colour straight down the column: 28 cells, one screen row apart.
  for (let i = 0; i < 28; i++) {
    mem8[cell] = colour;
    cell += 32; // one row down the 32-cell-wide map
  }
}
