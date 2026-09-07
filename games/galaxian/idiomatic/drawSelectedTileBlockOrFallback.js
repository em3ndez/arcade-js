// SPDX-License-Identifier: GPL-3.0-only
//
// drawSelectedTileBlockOrFallback -- pick a 2x2 tile block by a signed selector, or stamp a fixed fallback.
//
// WHAT IT IS
//   One of the two shape selectors in the tile-drawing kit. It reads the selector in B as a SIGNED byte:
//   a non-negative value is an index into the ROM tile-block source table (TILE_BLOCK_TABLE 0x215b), and
//   the block code fetched there is stamped at the pending destination; a negative value skips the table
//   and stamps a fixed fallback block seeded with tile 0xa4 instead.
//
// ROLE IN THE MACHINE
//   Called by the higher-level dispatch drawTileGlyphOrBlock (ROM 0x2131) on its carry-set (block) arm --
//   i.e. when the packed coordinate's bit 4 asked for a 2x2 block rather than a double-height glyph. The
//   non-negative path routes to drawIndexedTileBlock (ROM 0x2146), which looks the block code up by index
//   and stamps it via the DE-entry adapter; the negative path stamps the fallback block through the same
//   DE-entry adapter (drawTileBlock2x2AtDe, ROM 0x214a), so both arms draw at the destination staged in DE.
//
//   ROM 0x213d.  Grounding: [seen].
//
// LIVE-OUT: a 2x2 tile block written at the DE destination (via drawIndexedTileBlock / drawTileBlock2x2AtDe).
import { drawIndexedTileBlock } from "./drawIndexedTileBlock.js";
import { drawTileBlock2x2AtDe } from "./drawTileBlock2x2AtDe.js";

const FALLBACK_TILE = 0xa4; // block-base tile stamped when the selector is negative

export function drawSelectedTileBlockOrFallback(m, selector = m.regs.b) {
  // Test bit 7 (the sign bit of the Z80 B register). Clear -> selector is a valid table index: look the
  // block up in TILE_BLOCK_TABLE by index and stamp it at the pending DE destination.
  if ((selector & 0x80) === 0) return drawIndexedTileBlock(m, selector);
  // Sign bit set -> no valid index; stamp the fixed fallback block (base tile 0xa4) at DE instead.
  return drawTileBlock2x2AtDe(m, FALLBACK_TILE);
}
