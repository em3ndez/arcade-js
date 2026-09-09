// SPDX-License-Identifier: GPL-3.0-only
import { TILEMAP_PTR_LO, TILEMAP_PTR_HI, loc_8b, loc_8d, loc_8e, loc_ef, loc_0100 } from "./names.js";

/**
 * transposeScreenBitmap -- treat the whole tile grid as a monochrome bit image and rotate it one
 * column per pass through a scratch buffer.
 *
 * ROM 0x2XXX (playfield tile subsystem, screen-shuffle effect). Grounding: [code] -- read from the
 * routine; the $32/$33 video pointer and $0100 scratch page are [seen], $8b/$8d/$8e/$ef are behavioural
 * placeholders.
 *
 * ROLE IN THE MACHINE. Several state transitions (wave restart, respawn -- see mechanisms.md) call this
 * to visibly shuffle the screen: it reads the 32x30 tile map as a 1-bit-per-tile image (a tile is "on"
 * if it is in the solid glyph band), rotates that image, and rewrites every video cell as either a blank
 * or a solid tile. The rotation is achieved by passing each packed 8-tile column through a one-column
 * scratch buffer at $0100 (loc_0100): what goes IN this pass is what comes OUT next pass, so the image
 * slides one column each time the effect runs.
 *
 * HOW IT WALKS THE MAP. The video pointer $32/$33 is pinned with low byte 0 and high byte 0x04 (the video
 * base page). The routine processes eight tiles at a time. For each group it PACKS a bit mask MSB-first
 * (bit set when a tile's low six bits reach the solid band, `>= 0x38`), SWAPS that mask with the scratch
 * column (storing the new one, taking the previously stored one), then WRITES the swapped-in mask back
 * out over the same eight cells -- blank (0x00) where the bit is clear, solid (`0x3f ^ $ef`) where set.
 * $8b (loc_8b) is the working bit accumulator, $8d (loc_8d) indexes the scratch column, $8e (loc_8e)
 * remembers each group's row-start so the write pass revisits the same eight cells. It pages the pointer
 * high byte up on every row (Y) wrap and stops once it has covered all of video RAM: high byte 0x07 with
 * the low offset reaching 0xc0.
 *
 * LIVE-OUT: every cell of video RAM ($0400-$07ff region via the $32/$33 pointer) rewritten as blank or
 * solid; the $0100 scratch page holds the columns swapped through it; $8b/$8d/$8e left as the loop leaves
 * them; the $32/$33 pointer at the end-of-video state.
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
    // Each iteration shifts the accumulator left and feeds in the new tile's "solid?" bit as bit0,
    // while the bit shifted off the top (bit7) is kept as carry -- that carry is what seeds the write
    // pass below, tying the pack and the emit together the way the ROM's rol chain does.
    for (let x = 8; x > 0; x--) {
      const tile = m.mem8[m.mem16[TILEMAP_PTR_LO] + y] & 0x3f;
      carry = tile >= 0x38; // incoming bit0
      const v = m.mem8[loc_8b];
      m.mem8[loc_8b] = (v << 1) | (carry ? 1 : 0);
      carry = (v & 0x80) !== 0; // carry-out (bit7)
      y = (y + 1) & 0xff;
    }
    // Swap the packed mask with the scratch column; advance the counter. Storing this column and taking
    // back the PREVIOUS one is the whole rotation trick: the image slides one column per full pass.
    const sx = m.mem8[loc_8d];
    const scratchPrev = m.mem8[loc_0100 + sx];
    m.mem8[loc_8d] = m.mem8[loc_8d] + 1;
    m.mem8[loc_0100 + sx] = m.mem8[loc_8b];
    m.mem8[loc_8b] = scratchPrev; // now holds the swapped-in (previous) column
    // Write the 8 tiles back out, shifting the swapped-in mask MSB-first. Each shifted-off bit picks the
    // glyph: solid `0x3f ^ $ef` when the bit is set, blank 0x00 when clear. Revisit the same eight cells
    // via the remembered row start in $8e.
    y = m.mem8[loc_8e];
    for (let x = 8; x > 0; x--) {
      const v = m.mem8[loc_8b];
      m.mem8[loc_8b] = (v << 1) | (carry ? 1 : 0);
      carry = (v & 0x80) !== 0; // carry-out selects blank vs solid
      const a = carry ? 0x3f ^ m.mem8[loc_ef] : 0x00;
      m.mem8[m.mem16[TILEMAP_PTR_LO] + y] = a;
      y = (y + 1) & 0xff;
    }
    // On a Y (row-offset) wrap back to 0 we have finished a page: step the pointer high byte up one page.
    if (y === 0x00) m.mem8[TILEMAP_PTR_HI] = m.mem8[TILEMAP_PTR_HI] + 1; // page up on Y wrap
    // Keep going until we reach the very end of video RAM: the last row-offset (0xc0) on the last page
    // (high byte 0x07). Any earlier point just continues the sweep.
    if (y !== 0xc0) continue;
    if (m.mem8[TILEMAP_PTR_HI] !== 0x07) continue;
    return; // end of video RAM
  }
}
