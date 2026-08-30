// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blitGlyphBlock4x3 — stamp a 4-row x 3-column glyph block from a source run into the tilemap.
 * ROM 0x1f8c-0x1fa1. [seen]
 *
 * A leaf blitter. The tilemap is a 32-cell-wide grid, so cells one screen row apart are 0x20
 * (32) addresses apart. This routine paints a rectangle four rows tall and three columns wide:
 * for each row it copies three consecutive source bytes into three consecutive tilemap cells,
 * then jumps the destination down one screen row to line up the next row's left column.
 *
 * The row advance is split in two on the machine. Within a row the three writes step the
 * destination by incrementing only its LOW byte — an 8-bit bump that cannot carry into the high
 * byte, so the write pointer stays inside its current tilemap page while walking the three
 * columns. After the row, a single +0x1d finishes the trip to the next row: three low-byte
 * bumps (+3) plus 0x1d totals 0x20, exactly one screen row down and back to the left column.
 * The row count lives in the Z80's I register (the interrupt-vector register, borrowed here as
 * a spare down-counter) seeded to 4; the loop ends after the fourth row.
 *
 * LIVE-OUT: HL = dst + 0x80 (four rows x 0x20) AND DE = src + 12 (four rows x three bytes) —
 * both pointers advance. A caller memsets through the advanced HL right after this returns, so a
 * dropped HL corrupts that memset; DE is advanced faithfully though no caller is known to read
 * it. A wrong live-out is invisible to a memory-only test, hence both are stated explicitly.
 */
export function blitGlyphBlock4x3(m, src = m.regs.de, dst = m.regs.hl) {
  const { mem8 } = m;

  // Four glyph rows. On the machine the row counter is the I register, seeded to 4 and
  // decremented after each row; the loop stops after the fourth (0x20 x 4 = the 0x80 span).
  for (let row = 0; row < 4; row++) {
    // One glyph row: copy three source bytes into three side-by-side tilemap cells.
    for (let col = 0; col < 3; col++) {
      mem8[dst] = mem8[src];
      // Step across the row by bumping ONLY the low byte of the destination — an 8-bit inc
      // that never carries into the high byte, so the pointer stays within this tilemap page.
      dst = (dst & ~0xff) | ((dst + 1) & 0xff);
      src = u16(src + 1);
    }
    // Finish the trip to the next screen row: +0x1d after three low-byte bumps totals 0x20,
    // one full 32-cell tilemap row down, realigned to this block's left column.
    dst = u16(dst + 0x1d);
  }
  // Both pointers left advanced past the block: dst + 0x80 and src + 12 (both live-out).
  return [(m.regs.hl = u16(dst)), (m.regs.de = u16(src))];
}
