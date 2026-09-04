// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";

/**
 * drawDigit (ROM 0x09c5) -- plot one decimal digit glyph.
 *
 * WHAT IT IS
 *   Turns a small value in A into a sprite id and draws it as an 8x8 glyph. The digit glyphs sit
 *   contiguously in the sprite table starting at id 0x1a, so adding 0x1a to A (a 0-9 digit) reaches the
 *   glyph for that digit; drawSprite8x8 then resolves the id to its 8 source bytes and blits it.
 *
 * ROLE IN THE MACHINE
 *   The numeric leaf under the score/lives/credit readouts: drawBcdByte calls it twice (high nibble then
 *   low) to render a BCD byte as two digits, and drawLivesDigit calls it for the single lives digit.
 *   Because each BCD nibble is already 0-9, the +0x1a mapping lands on a real digit glyph.
 *
 * ROM 0x09c5.  Grounding: [seen] (names.js cert for 0x09c5).
 *
 * LIVE-OUT: HL, advanced one glyph-cell down the screen by drawSprite8x8 (so a following digit chains on).
 */
// Map a low nibble (0-9) to its decimal-glyph id and plot the glyph; live-out HL.
export function drawDigit(m, a = m.regs.a) {
  // Digit value + 0x1a = the glyph id for that digit; drawSprite8x8 plots it and returns HL advanced.
  return drawSprite8x8(m, u8(a + 0x1a));
}
