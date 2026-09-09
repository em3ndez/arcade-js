// SPDX-License-Identifier: GPL-3.0-only
import { TILEMAP_PTR_LO, TILEMAP_PTR_HI, loc_8b, loc_8d, loc_8e, loc_ef, loc_0100 } from "./names.js";

/**
 * transposeScreenBitmap — rotate/transpose the tilemap as a monochrome bit image through a
 * one-column scratch buffer, rewriting every video cell as a blank or a solid tile. Walks the
 * 32x30 map eight tiles at a time, packing each group into an 8-bit mask, swapping it through
 * the scratch column (which rotates the image one column per pass), then writing it back. [code]
 */
export function transposeScreenBitmap(m) {
  m.mem8[TILEMAP_PTR_LO] = 0x00; // pointer low byte pinned at 0
  m.mem8[TILEMAP_PTR_HI] = 0x04; // pointer high byte -> video base
  m.mem8[loc_8d] = 0x00; // scratch-column counter
  let y = 0x00; // row-start / running tile offset within the page
  for (;;) {
    m.mem8[loc_8b] = 0x00; // fresh bit accumulator
    m.mem8[loc_8e] = y; // remember the row start for the write pass
    let carry = false;
    // Pack 8 tiles: bit set when (tile & 0x3f) >= 0x38 (the solid glyph band), MSB-first.
    for (let x = 8; x > 0; x--) {
      const tile = m.mem8[m.mem16[TILEMAP_PTR_LO] + y] & 0x3f;
      carry = tile >= 0x38; // incoming bit0
      const v = m.mem8[loc_8b];
      m.mem8[loc_8b] = (v << 1) | (carry ? 1 : 0);
      carry = (v & 0x80) !== 0; // carry-out (bit7)
      y = (y + 1) & 0xff;
    }
    // Swap the packed mask with the scratch column; advance the counter.
    const sx = m.mem8[loc_8d];
    const scratchPrev = m.mem8[loc_0100 + sx];
    m.mem8[loc_8d] = m.mem8[loc_8d] + 1;
    m.mem8[loc_0100 + sx] = m.mem8[loc_8b];
    m.mem8[loc_8b] = scratchPrev; // now holds the swapped-in (previous) column
    // Write the 8 tiles back out, shifting the swapped-in mask MSB-first.
    y = m.mem8[loc_8e];
    for (let x = 8; x > 0; x--) {
      const v = m.mem8[loc_8b];
      m.mem8[loc_8b] = (v << 1) | (carry ? 1 : 0);
      carry = (v & 0x80) !== 0; // carry-out selects blank vs solid
      const a = carry ? 0x3f ^ m.mem8[loc_ef] : 0x00;
      m.mem8[m.mem16[TILEMAP_PTR_LO] + y] = a;
      y = (y + 1) & 0xff;
    }
    if (y === 0x00) m.mem8[TILEMAP_PTR_HI] = m.mem8[TILEMAP_PTR_HI] + 1; // page up on Y wrap
    if (y !== 0xc0) continue;
    if (m.mem8[TILEMAP_PTR_HI] !== 0x07) continue;
    return; // end of video RAM
  }
}
