// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStackedBcdDigits — paint one packed-BCD byte into the tilemap as a two-digit field,
 * tens digit at the cursor and units digit one row above it. [seen]
 *
 * ROM 0x1119-0x1130. A pure leaf: two tile writes, reads only its inputs, calls nothing.
 *
 * A "packed-BCD byte" holds two decimal digits, one per nibble: the high nibble is the tens
 * digit, the low nibble the units. The game keeps small counters this way so a value can be
 * shown on the HUD without any binary-to-decimal conversion — each nibble is already 0-9 and,
 * because the character ROM lays the digit glyphs 0..9 at tile codes 0x00..0x09, a nibble IS
 * its own tile code. So this routine just splits the byte and stores each nibble as a tile.
 *
 * The two digits stack VERTICALLY. Tilemap rows are 0x20 tiles apart in address order, and
 * addresses run downward as you climb the screen, so the units digit — written one row "up" —
 * lands at cursor - 0x20. This is how a caller renders a right-way-up two-digit field when it
 * only has the address of the lower (tens) cell; e.g. the display of HUNTER_SPAWN_SUBCOUNTER.
 *
 * Leading-zero suppression: a tens digit of 0 is drawn as the blank tile (0x10) rather than a
 * "0" glyph, so a value below ten shows as a single digit with a blank above it. The units
 * digit is never suppressed.
 *
 * LIVE-OUT (registers, for a caller that reads them straight back): HL = the advanced cursor
 * (the units cell, one row up); E = the source byte; BC = the row-up stride (-0x20). A and the
 * flags carry nothing meaningful. Idiomatic callers instead take { next, byte } from the return.
 */
import { u16 } from "../../../core/int.js";

// Tile code of the blank character; substituted for a leading-zero tens digit.
const BLANK_TILE = 0x10;
// One tilemap row toward lower addresses = one row UP the screen.
const ROW_STRIDE_UP = -0x20;

export function drawStackedBcdDigits(m, dst = m.regs.hl, value = m.regs.a) {
  const { mem8 } = m;

  // Tens digit = high nibble. It is its own tile code (glyphs 0..9 sit at codes 0x00..0x09),
  // except a zero tens digit is blanked so small numbers show without a leading "0".
  const tens = (value >> 4) & 0x0f;
  mem8[dst] = tens === 0 ? BLANK_TILE : tens;

  // Step one tilemap row upward (toward lower addresses) and drop the units digit — the low
  // nibble, likewise used directly as its glyph's tile code — into that cell.
  const next = u16(dst + ROW_STRIDE_UP);
  mem8[next] = value & 0x0f;

  return (m.regs.bc = u16(ROW_STRIDE_UP), { next: (m.regs.hl = next), byte: (m.regs.e = value & 0xff) });
}
