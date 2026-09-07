// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawTileGlyphOrBlock (ROM 0x2131) -- the figure-draw dispatch: block vs. double-height glyph.
 *
 * WHAT IT IS
 *   The higher-level tile-figure draw entry, keyed on the carry flag that mapPackedCoordToVram leaves as
 *   its block-versus-glyph selector (a coordinate with bit 4 set means "2x2 block", clear means "single
 *   double-height glyph"). On carry it stamps a 2x2 tile block chosen by the B selector; otherwise it
 *   fetches B's tile code from the glyph table and paints a double-height glyph at the incoming pointer.
 *
 * ROLE IN THE MACHINE
 *   Sits above the stamp primitives in the figure-draw stack (mechanisms.md "Choosing block, indexed
 *   block, or glyph"). The block arm calls drawSelectedTileBlockOrFallback (0x213d), which indexes the
 *   ROM tile-block table by the signed B (or stamps the fixed fallback tile 0xa4 when B is negative). The
 *   glyph arm reads the tile code via fetchIndexedTableByte (RST-20, 0x0020) from table loc_2157 (0x2157)
 *   and paints it through drawDoubleHeightTile (0x25a9), which stacks tile and tile+2 one row apart.
 *
 * Grounding: [seen] (names.js cert for 0x2131).
 *
 * LIVE-OUT: whichever draw routine ran (its own return); on the block arm HL and DE are first swapped so
 *   the block stamps at the destination staged in DE. On the glyph arm the destination is the incoming HL.
 */
import { loc_2157 } from "./names.js";
import { drawSelectedTileBlockOrFallback } from "./drawSelectedTileBlockOrFallback.js";
import { fetchIndexedTableByte } from "./fetchIndexedTableByte.js";
import { drawDoubleHeightTile } from "./drawDoubleHeightTile.js";

export function drawTileGlyphOrBlock(m, carry = m.regs.fC, index = m.regs.b, hl = m.regs.hl, de = m.regs.de) {
  // BLOCK arm: exchange the two working pointers so the block draws at the DE-staged destination, then
  // stamp the 2x2 block selected by B (fixed fallback tile 0xa4 when B is negative). Tail return.
  if (carry) return (m.regs.hl = de, m.regs.de = hl, drawSelectedTileBlockOrFallback(m, index));

  // GLYPH arm: stash the incoming HL as the true destination -- the table fetch below clobbers HL.
  const dest = hl;
  // Look B's tile code up in the glyph table loc_2157 (RST-20 indexed fetch: HL += A, then A = (HL)).
  const tile = fetchIndexedTableByte(m, index, loc_2157);
  // Paint that code as a double-height glyph (tile at dest, tile+2 one tilemap row below) at the stashed HL.
  return drawDoubleHeightTile(m, tile, dest);
}
