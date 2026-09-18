// SPDX-License-Identifier: GPL-3.0-only
/**
 * cycleColumnColour — advance the shared colour index and repaint one screen column with it.
 *
 * The colour-cycle animation step. A single shared colour index is bumped to its next value —
 * kept clear of one palette bit so it never strays out of the cycling range — stored back so the
 * next call continues, then stamped straight down one full-height column of colour RAM. The
 * attract screen-setup loops call this over and over while counting a delay down, so the chosen
 * column shimmers through the palette one shade per pass. `column` is the offset into the top row
 * of colour RAM, so the paint starts at that column's top cell and runs 28 cells down, one screen
 * row (32 cells across the 32-wide map) apart.
 */
export function cycleColumnColour(m, column = m.regs.a) {
  const { mem8 } = m;

  // Advance the shared colour index one shade, keeping one palette bit clear, and store it back.
  const colour = (mem8[0x8057] + 1) & 0xf7;
  mem8[0x8057] = colour;

  // Stamp it down the selected column: 28 cells, each one screen row (32 cells) further along.
  let cell = 0x8840 + column;
  for (let i = 0; i < 28; i++) {
    mem8[cell] = colour;
    cell += 32;
  }
}
