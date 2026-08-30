// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * renderDigitWithBlanking — paint one decimal digit into the tilemap with leading-zero
 * suppression, then step the write cursor to the next digit position. [seen]
 *
 * ROM 0x059d. This is the per-digit worker behind the score/HUD number fields. A caller walks
 * a multi-digit field from its most-significant digit downward, calling this once per digit,
 * threading a running "blank budget" through the calls so that high-order zeros come out as
 * blank tiles rather than a row of 0s (e.g. a score of 40 shows as "  40", not "0040"). The
 * budget is the count of leading positions still eligible to be blanked; the first non-zero
 * digit spends it to zero, and every digit from there on prints literally.
 *
 * The three inputs arrive in registers, matching the ROM's calling convention:
 *   - cursor (IX): tilemap address of the tile to paint.
 *   - stride (DE): signed step added to the cursor after the write, moving to the next digit
 *     cell. Number fields are laid out along a column, so this is typically a row stride.
 *   - digit (A):   the digit to render; only the low nibble is significant (BCD digit).
 *   - blankBudget (C): leading positions still eligible for blanking; non-zero means "a zero
 *     here should print blank, not 0".
 *
 * Decision, per the ROM:
 *   - low nibble non-zero -> paint the digit itself and END the blank run (budget forced to 0).
 *   - low nibble zero, budget still available -> paint the blank tile and spend one budget unit.
 *   - low nibble zero, budget exhausted -> paint a genuine 0.
 *
 * A leaf: exactly one tile write, calls nothing.
 *
 * LIVE-OUT: the painted tile; the cursor advanced by the stride (16-bit wrap), left in IX; and
 * the updated blank budget, left in C — so the next call in the field continues from both. Also
 * returned as the tuple [cursor, budget] for callers that read the values directly.
 */

// Tile code for a suppressed (blanked) leading zero. 0x10 is the blank glyph in the number font.
const BLANK_TILE = 0x10;

export function renderDigitWithBlanking(m, cursor = m.regs.ix, stride = m.regs.de, digit = m.regs.a, blankBudget = m.regs.c) {
  const { mem8 } = m;

  // Isolate the BCD digit: the ROM masks A with 0x0f, so only the low nibble names the digit.
  const nibble = digit & 0x0f;
  let tile, budget;
  if (nibble !== 0) {
    tile = nibble; //              a real digit ends the leading-blank run
    // A significant digit has appeared: from here on the field prints literally, so clear the
    // budget to force every following digit (including zeros) to print as itself.
    budget = 0;
  } else if (blankBudget !== 0) {
    tile = BLANK_TILE; //          still blanking -> spend one blank
    // Still within the leading run: paint blank and consume one budget unit (8-bit decrement).
    budget = u8(blankBudget - 1);
  } else {
    tile = 0; //                   budget spent -> a genuine zero digit
    // No budget left: this zero is significant (a mid- or low-order digit), so print a real 0.
    budget = 0;
  }

  // Stamp the chosen tile at the cursor, then walk the cursor to the next digit cell by the
  // stride (16-bit wrap). The updated cursor and budget are seated back for the next digit.
  mem8[cursor] = tile;
  return [m.regs.ix = u16(cursor + stride), m.regs.c = budget];
}
