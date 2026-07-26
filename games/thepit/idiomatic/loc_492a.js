// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_492a — paint one 32-tile screen column, then colour it.  ROM 0x492a.
 *
 * Part of the boot screen-drawing family (siblings loc_46f4 / loc_4785 / loc_47a1,
 * each drawing a different column). This member lays a fixed 32-tile column into
 * video RAM from a ROM strip, bottom cell upward, then hands off to loc_3e1d to
 * fill the matching colour-RAM column. Reached once, while the screen is built.
 *
 * Name kept neutral: the column-painting ACTION is clear, but which on-screen
 * column this one is has not been confirmed to the naming bar, and every value is
 * hardwired — so it earns no specific English name yet.
 *
 * Memory-equivalent to the frozen oracle — equivalence-492a.test.js.
 * GATE:     real dispatch — fires once as the screen is drawn; straight-line (one
 *           fixed-length loop, no branches), so that single entry covers the whole
 *           path. Teeth = a corrupted column-cell store.
 * LIVE-OUT: memory-only — the 32 painted video-RAM cells, plus the colour-RAM
 *           column and BOARD_MODE that the tail callee loc_3e1d writes. SP/PC land
 *           where loc_3e1d's return goes (both sides run the same callee). The
 *           oracle's leftover source pointer is dead — both successors reload it
 *           before reading — so it is not compared.
 * NAMES:    none — the ROM tile strip and the painted column sit outside the named
 *           work-RAM range; loc_3e1d owns the colour-RAM + BOARD_MODE writes.
 */

export function loc_492a(m) {
  const { mem8, regs } = m;

  // The column is 32 tiles tall. Its tile codes are a fixed strip in ROM, laid
  // into video RAM from the BOTTOM cell upward — one full text row (32 cells)
  // higher per tile, so the strip reads bottom-to-top.
  const TILE_STRIP = 0x49c7; // ROM: the column's 32 tile codes
  const COLUMN_BOTTOM = 0x93f9; // video RAM: bottom cell of this column
  const ROW = 32; // one full text row = 32 cells
  for (let i = 0; i < 32; i++) {
    mem8[COLUMN_BOTTOM - i * ROW] = mem8[TILE_STRIP + i];
  }

  // Colour that same column: loc_3e1d is still the frozen oracle, so pass it the
  // fill colour and the column it paints down the register way. Its trailing
  // return lands in this routine's caller, so this is a tail hand-off — return it.
  regs.c = 2; // colour code for the column
  regs.a = 25; // which colour-RAM column loc_3e1d fills
  return m.call(0x3e1d);
}
