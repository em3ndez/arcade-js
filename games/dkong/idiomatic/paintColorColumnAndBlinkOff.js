// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndBlinkOff — the rivet-board colour-cycle arm: preset the fill code, paint a
 * 3-cell descending colour column, then blink the decorative sprite pair OFF.
 *
 * On the rivet board the colour-cycle blink block repaints two colour-RAM columns and then routes
 * by the sweep-counter bit and Mario's X. This routine is the arm taken when Mario is in the right
 * half of the screen. It does two things and returns:
 *
 *   1. Paint a colour-RAM column. It presets the fill value to 0xEF and points at the column top,
 *      then runs a 3-cell DESCENDING fill — laying 0xEF, 0xEE, 0xED into the top cell and the two
 *      cells one stride below it. The STRIDE is a live-in from the colour-cycle driver, which loads
 *      one tilemap row, so in practice the three cells are a vertical run one row apart, cycling
 *      colour as the sweep advances.
 *
 *   2. Blink the sprite pair OFF: force the flip/visibility bit clear on both decorative sprites'
 *      code bytes. Record 0 is committed directly and record 1 goes through the shared store tail,
 *      which may still apply its once-per-sweep low-two-bit tile toggle keyed on the colour counter
 *      staged in a register.
 *
 * Writes exactly five cells (the three colour cells and the two sprite code bytes); reads the
 * stride and the colour counter as register live-ins, plus those same two sprite code bytes.
 *
 * LIVE-OUT: memory-only — the three colour cells and the two sprite code bytes. No live registers
 * or flags: the exit tail is memory-only and its caller runs the next routine without reading the
 * accumulator, the counter registers or the flags. The stride and the colour counter are read-only
 * live-ins, passed straight through to the callees on the machine, because both callees still take
 * them in registers.
 */
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { blinkSpritePairOff } from "./blinkSpritePairOff.js";

// Top of the colour-RAM column this arm repaints; the fill steps down by the live-in stride.
const COLOR_COLUMN_TOP = 0x7583;

export function paintColorColumnAndBlinkOff(m) {
  const { regs } = m;

  // Preset the descending colour-column fill: the value, and the cell to start at.
  regs.a = 0xef;
  regs.hl = COLOR_COLUMN_TOP;

  // Paint the 3-cell descending colour column. The stride is a live-in and passes straight through
  // on the machine.
  fillDescendingColumn(m);

  // Blink OFF: clear the visibility bit on both decorative sprite records, record 1 through the
  // shared store tail keyed on the colour counter (also a live-in, also passed through).
  blinkSpritePairOff(m);
}
