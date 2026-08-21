// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blitGlyphBlock4x3 — copy a 4-row x 3-column glyph block from a source into the tilemap. Each row
 * copies three source bytes to the destination, advancing the destination LOW byte only (the row
 * stays within its tilemap page), then steps the full pointer +0x1d (net +0x20 per row). A leaf.
 *
 * LIVE-OUT: HL = dst + 0x80 AND DE = src + 12 — both pointers advance. A caller memsets through the
 * advanced HL right after the call, so a dropped HL corrupts that memset; DE is advanced faithfully
 * (no caller is known to read it). A wrong live-out is invisible to a memory-only test.
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
  return [(m.regs.hl = u16(dst)), (m.regs.de = u16(src))]; // advanced dest + source (both live-out)
}
