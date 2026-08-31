// SPDX-License-Identifier: GPL-3.0-only
import { paintTileBlock2x2 } from "./paintTileBlock2x2.js";
import { VRAM_TILE_BLOCK_DEST_A, VRAM_TILE_BLOCK_DEST_B, TILE_BLOCK_2X2_SRC } from "./names.js";
/**
 * paintTwo2x2TileBlocks — stamp the same 2x2 tile pattern into two fixed spots on screen.
 *
 * ROM 0x0a52. Grounding: [seen].
 *
 * WHAT IT IS
 * The background the player sees is a grid of tiles: the video hardware reads one tile-code
 * byte per cell from a tilemap laid out 0x20 (32) cells to a row, so the cell one row below
 * any given cell sits exactly 0x20 bytes further along. A "2x2 tile block" is a little square
 * of four adjacent cells — two across, two down — whose picture is described by a four-byte
 * run of tile codes. This routine paints that four-byte pattern into two such squares, at two
 * separate anchors, from a single shared source run in ROM.
 *
 * ROLE IN THE MACHINE
 * A leaf of the block-stamp family that decorates the playfield: it lays down a fixed pair of
 * 2x2 graphics as part of building the screen. Both squares are drawn from the very same
 * source pattern (TILE_BLOCK_2X2_SRC, ROM 0x0a72), so the two spots on screen end up showing
 * identical artwork; only their positions differ. Nothing is ever read back — the routine
 * only writes tiles.
 *
 * LIVE-OUT: memory only — the eight painted tiles (four per block). No register or flag
 * survives for a later reader; this exists purely for its effect on the tilemap.
 */
export function paintTwo2x2TileBlocks(m) {
  // First block — anchored at VRAM_TILE_BLOCK_DEST_A (0x82aa) on the tilemap. The shared
  // four-byte pattern at TILE_BLOCK_2X2_SRC (ROM 0x0a72) is stamped into the 2x2 square whose
  // top-left corner is this anchor: top-left and top-right on the first row, then the two cells
  // directly beneath them one tilemap row (0x20 cells) down.
  paintTileBlock2x2(m, VRAM_TILE_BLOCK_DEST_A, TILE_BLOCK_2X2_SRC);

  // Second block — anchored at VRAM_TILE_BLOCK_DEST_B (0x826a), a different spot on the same
  // tilemap. It reuses the identical source pattern (TILE_BLOCK_2X2_SRC), so this square shows
  // the same four tiles as the first; the source pointer is reloaded here rather than carried
  // forward from the first stamp, so the two blocks are independent draws from one pattern.
  paintTileBlock2x2(m, VRAM_TILE_BLOCK_DEST_B, TILE_BLOCK_2X2_SRC);
}
