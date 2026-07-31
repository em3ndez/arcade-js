// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColourColumnAt — paint a full-height colour-RAM column with one colour.  ROM 0x3e1d.
 *
 * Colours a single vertical column of the playfield in one flat colour. Both inputs
 * come in directly: `columnOffset` picks which column (an offset into colour RAM from
 * its top-of-column anchor), and `colour` is the palette byte stamped into every cell
 * of that column. The column runs a fixed 28 cells straight down — one screen row per
 * step, which is 32 cells further along the 32-cell-wide map — starting two rows below
 * the colour-RAM base, so it tints the column over the playfield area beneath the top
 * margin.
 *
 * Before painting, the colour is recorded as the pipeline's shared colour index (the
 * same cell the sibling colour fills read and advance), so a following fill continues
 * from this colour. This is the fixed-height, arguments-in variant of the colour-column
 * fill: the sibling fillColourColumn takes its column cursor, run length, and colour
 * from staged work RAM, whereas this one is handed the column and colour outright and
 * always paints 28 cells.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e1d.test.js.
 * GATE:     real captured attract dispatches (0x3e1d is fed ~9 times in 1500 frames by
 *           the fixed-screen / panel colour draws) checked on the full RAM contract,
 *           plus an exhaustive sweep over every (columnOffset 0..63, colour 0..255) on a
 *           real captured base — 16,384 combos covering every real column and colour.
 *           Teeth: a wrong-colour twin and a wrong-row-stride twin.
 * LIVE-OUT: memory-only — the 28 painted colour cells plus the recorded colour index at
 *           0x8057. The leftover cursor / count / flag registers are dead: callers
 *           tail-jump or call in and their next act re-stages scratch, never reading a
 *           register this leaves behind.
 * NAMES:    columnOffset and colour are the two register inputs, surfaced as parameters.
 *           0x8840 (colour-RAM top-of-column anchor) and 0x8057 (the shared colour index)
 *           stay hex: ram.js names 0x8057 BOARD_MODE for a mode-index role used elsewhere,
 *           which does not describe the colour byte staged here, so it is kept hex rather
 *           than misread (matching the sibling fillColourColumn).
 */
export function fillColourColumnAt(m, columnOffset = m.regs.a, colour = m.regs.c) {
  const { mem8 } = m;

  // Record the colour as the shared colour index the sibling colour fills read.
  mem8[0x8057] = colour;

  // Top cell of the chosen column: colour RAM's top-of-column anchor sits two rows
  // below its base (0x8840 = base + two rows), and the offset selects the column.
  let cell = 0x8840 + columnOffset;

  // Stamp the colour straight down the column: 28 cells, one screen row apart.
  for (let i = 0; i < 28; i++) {
    mem8[cell] = colour;
    cell += 32; // one row down the 32-cell-wide map
  }
}
