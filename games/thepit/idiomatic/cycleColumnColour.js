// SPDX-License-Identifier: GPL-3.0-only
/**
 * cycleColumnColour — advance the shared colour index and repaint one screen column with it.  ROM 0x3e13.
 *
 * The colour-cycle animation step. A single shared colour index is bumped to its next
 * value — kept clear of one palette bit so it never strays out of the cycling range —
 * stored back so the next call continues from where this one left off, and then stamped
 * straight down one full-height column of colour RAM. The attract screen-setup loops
 * (showSetupScreen, showBonusScreen) call this over and over while counting a delay down, so the chosen
 * column shimmers through the palette one shade per pass.
 *
 * `column` picks which column to repaint: it is the offset into the top row of colour
 * RAM, so the paint starts at that column's top cell and runs 28 cells down the map, one
 * screen row (32 cells across the 32-wide map) apart.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e13.test.js.
 * GATE:     real captured attract dispatch (the screen-setup loops feed it column 6,
 *           reached within ~400 frames) compared on RAM, plus an exhaustive crafted
 *           sweep over every column 0..31 and every starting index 0..255 — the two
 *           inputs poked identically on both sides — which also pins the increment's
 *           bit-3-clear at the palette edge. Teeth: a twin that drops the bit-3 clear
 *           and a twin with the wrong paint stride.
 * LIVE-OUT: memory-only — the advanced colour index at 0x8057 and the 28 repainted
 *           colour-RAM cells. The leftover colour value in the accumulator is dead: the
 *           animation-loop callers immediately delay and re-loop, reading painted memory
 *           and the loop timer, never a leftover register.
 * NAMES:    none from ram.js. 0x8057 is the colour-cycle byte the sibling fillColourColumn
 *           also keeps hex — ram.js names it BOARD_MODE for a mode-index role used
 *           elsewhere, which does not describe the colour index cycled and painted here,
 *           so it is kept hex rather than misread. 0x8840 is colour RAM (outside the
 *           work-RAM range ram.js covers).
 */
export function cycleColumnColour(m, column = m.regs.a) {
  const { mem8 } = m;

  // Advance the shared colour index to its next shade, keeping one palette bit clear so
  // the cycle stays inside its colour range, and store it back for the next step.
  const colour = (mem8[0x8057] + 1) & 0xf7;
  mem8[0x8057] = colour;

  // Stamp the new colour straight down the selected column: 28 cells, each one screen
  // row (32 cells) further along, starting from that column's top cell.
  let cell = 0x8840 + column;
  for (let i = 0; i < 28; i++) {
    mem8[cell] = colour;
    cell += 32;
  }
}
