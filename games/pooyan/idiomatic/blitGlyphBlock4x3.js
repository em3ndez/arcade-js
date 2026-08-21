// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blitGlyphBlock4x3 — copy a 4-row x 3-column glyph block from a source into the tilemap.
 *
 * For each of four rows, copies three consecutive source bytes into the destination, advancing
 * the destination LOW byte only (the row stays within its tilemap page), then steps the full
 * pointer one row down (+0x1d after the three low-byte bumps, i.e. +0x20 per row) to the next
 * row's column origin. A leaf — writes only the twelve destination cells, calls nothing.
 *
 * LIVE-OUT: memory only (the twelve glyph cells). Returns nothing; no caller reads back the
 * advanced source/destination pointers (each either rets or reloads its registers).
 */
export function blitGlyphBlock4x3(m, src = m.regs.de, dst = m.regs.hl) {
  const { mem8 } = m;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      mem8[dst] = mem8[src];
      dst = (dst & ~0xff) | ((dst + 1) & 0xff); // inc L only: low byte wraps in place, no carry to high
      src = u16(src + 1);
    }
    dst = u16(dst + 0x1d); // step to the next row's column origin (net +0x20 with the three L bumps)
  }
}
