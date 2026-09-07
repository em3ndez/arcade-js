// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawFixedTilePairVertical — stamp the decorative double-height tile pair from the fixed seed 44.
 *
 * WHAT IT IS
 *   A zero-argument-flavoured entry point into the double-height glyph writer that hard-wires the tile
 *   code. Galaxian's decorative glyph family starts at code 44 (0x2c); this routine is the "vertical
 *   pair" convenience over that family — it paints code 44 at the destination cell and the stepped code
 *   one tilemap row below, so a single logical glyph occupies two stacked character cells.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x25a7 is a two-byte prologue that loads the fixed seed and falls straight into
 *   drawDoubleHeightTile at 0x25a9 (imported here aliased as loc_25a9). That writer stamps tile A at
 *   (HL) and tile A+2 at (HL+0x20) — 0x20 == 32 cells == one tilemap row — so from seed 44 it lays 44
 *   on top and 46 directly beneath. It is one of the fixed-seed conveniences (alongside the horizontal
 *   pair and the 2x2 block writers) that the tile kit exposes for the 44-based decorative glyphs.
 *   Memory-only: it writes VRAM and preserves DE.
 *
 * ROM 0x25a7.  Grounding: [seen].
 *
 * LIVE-OUT: whatever drawDoubleHeightTile leaves (VRAM cells at dest and dest+0x20 painted; DE preserved).
 */
import { drawDoubleHeightTile as loc_25a9 } from "./drawDoubleHeightTile.js";

// The fixed starting tile/glyph code this entry point seeds (44 == 0x2c, base of the decorative family).
const TILE_SEED = 44;

export function drawFixedTilePairVertical(m, dest = m.regs.hl) {
  // Paint the double-height pair at `dest`: seed tile 44 at the cell, code 46 one tilemap row below.
  loc_25a9(m, TILE_SEED, dest);
}
