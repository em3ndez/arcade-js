// SPDX-License-Identifier: GPL-3.0-only
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import { GLYPH_TILES_A, GLYPH_TILES_B, GLYPH_BLOCK_DEST } from "./names.js";
/**
 * stampSelectedGlyphBlock — render one of two glyph blocks into the tilemap.
 *
 * Bit 5 of the incoming selector chooses which fixed 3x3 glyph source is stamped into the
 * tilemap cell: clear picks the first table, set the second. A leaf that delegates the
 * stamp to blitTile3x3Block.
 *
 * LIVE-OUT: memory only — the nine stamped tiles. The block helper advances HL/DE as its
 * own bridge, but the caller reloads them, so neither survives as game state here.
 */
const SELECT_BIT = 0x20;

export function stampSelectedGlyphBlock(m, selector = m.regs.b) {
  const table = (selector & SELECT_BIT) !== 0 ? GLYPH_TILES_B : GLYPH_TILES_A;
  return blitTile3x3Block(m, GLYPH_BLOCK_DEST, table);
}
