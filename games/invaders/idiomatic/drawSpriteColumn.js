// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

/**
 * drawSpriteColumn — copy a run of source bytes down a vertical screen strip.
 *
 * WHAT IT IS
 *   The plainest byte-aligned column blitter. Over B rows it copies one source byte into the screen,
 *   advancing the source one byte per row and the destination one screen row (0x20 bytes) per row —
 *   laying a "column" (a vertical strip) of B bytes down the display.
 *
 * ROLE IN THE MACHINE
 *   Space Invaders treats video RAM as 32-byte columns walked top-to-bottom by adding 0x20 to the
 *   pointer (see mechanisms.md "Sprite drawing"). This is the core copy every byte-aligned draw sits
 *   on: drawSprite8x8 feeds it an 8-row glyph, drawSpriteColumn16 forces the count to 0x10, and the
 *   reserve-life icons and saucer sprite drive it directly. Because the source is read straight and
 *   the destination steps by a full row, one call paints a single-byte-wide vertical band. Unlike the
 *   shifted blitters it does no bit-shifting, so the sprite lands only on an eight-pixel boundary.
 *
 * ROM 0x1439.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the destination advanced by 0x20*B (one stride past the last row). Also returned.
 * DE/B default from the registers when the caller omits them.
 */
export function drawSpriteColumn(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b) {
  const rows = b || 256; // a count of 0 wraps to a full 256-byte pass
  // Track source and destination cursors locally; both walk forward, but by different strides.
  let src = de;
  let dst = hl;
  // For each row: copy one source byte to the screen, step the source one byte, and drop the
  // destination one full screen row (0x20) so successive bytes stack vertically into a column.
  for (let i = 0; i < rows; i++) {
    m.mem8[dst] = m.mem8[src];
    src = u16(src + 1);
    dst = u16(dst + 0x20);
  }
  // Hand back the destination sitting one stride below the column, so a caller can chain the next
  // draw (this is how drawSprite8x8 strings glyphs down a text line).
  return (m.regs.hl = dst);
}
