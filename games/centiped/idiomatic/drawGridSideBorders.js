// SPDX-License-Identifier: GPL-3.0-only
import { loc_8b, loc_91, loc_92, loc_a5, loc_a6, loc_f6, loc_f7 } from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * drawGridSideBorders -- draw the two vertical side runs of the play grid.
 *
 * Builds a 16-bit draw cursor (loc_91 low / loc_92 high) for one side by folding fixed constants
 * against the loc_f6/loc_f7 orientation bytes, then walks a fixed six-cell run handing each cell
 * to writeMaskedByteAndAdvancePointer with a glyph chosen by a down-counter's sign (0x1f border
 * tile while non-negative, 0x00 blank once negative). Done twice: the second run uses opposite
 * constants and 6-loc_a6 as its counter, so the two runs address opposite sides. loc_8b is the
 * shared six-cell loop counter. Writes the grid cells and the advanced cursor, and leaves
 * loc_8b at 0. [code]
 */

const BORDER_GLYPH = 0x1f;
const BLANK_GLYPH = 0x00;
const RUN_LEN = 0x06; // each side run paints six cells ($8B counts them down)

export function drawGridSideBorders(m) {
  const { mem8 } = m;

  // First side: cursor high = 0xDF ^ $F6, and a 2-bit stride selector into $92 from 0x04 ^ $F7.
  mem8[loc_8b] = RUN_LEN;
  mem8[loc_92] = (0x04 ^ mem8[loc_f7]) & 0x06;
  mem8[loc_91] = 0xdf ^ mem8[loc_f6];
  let counter = mem8[loc_a5];
  do {
    counter = (counter - 1) & 0xff;
    writeMaskedByteAndAdvancePointer(m, (counter & 0x80) === 0 ? BORDER_GLYPH : BLANK_GLYPH);
    mem8[loc_8b] = mem8[loc_8b] - 1;
  } while (mem8[loc_8b] !== 0);

  // Second side: opposite constants (0x06 ^ $F7 high-selector, 0x5F ^ $F6 cursor); the counter starts
  // at 6-$A6 and the glyph polarity is inverted (blank while non-negative, border once negative).
  mem8[loc_92] = 0x06 ^ mem8[loc_f7];
  mem8[loc_91] = 0x5f ^ mem8[loc_f6];
  mem8[loc_8b] = RUN_LEN;
  counter = (RUN_LEN - mem8[loc_a6]) & 0xff; // sec; sbc $a6
  do {
    counter = (counter - 1) & 0xff;
    writeMaskedByteAndAdvancePointer(m, (counter & 0x80) === 0 ? BLANK_GLYPH : BORDER_GLYPH);
    mem8[loc_8b] = mem8[loc_8b] - 1;
  } while (mem8[loc_8b] !== 0);
}
