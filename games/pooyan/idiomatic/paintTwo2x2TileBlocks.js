// SPDX-License-Identifier: GPL-3.0-only
import { paintTileBlock2x2 } from "./paintTileBlock2x2.js";
import { VRAM_TILE_BLOCK_DEST_A, VRAM_TILE_BLOCK_DEST_B, TILE_BLOCK_2X2_SRC } from "./names.js";
/**
 * Stamp two 2x2 tile blocks into video RAM from one shared four-byte source pattern: the
 * first block at one anchor, the second at another. Nothing is read back.
 *
 * LIVE-OUT: memory only (the eight tiles); no register survives for a reader.
 */
export function paintTwo2x2TileBlocks(m) {
  paintTileBlock2x2(m, VRAM_TILE_BLOCK_DEST_A, TILE_BLOCK_2X2_SRC);
  paintTileBlock2x2(m, VRAM_TILE_BLOCK_DEST_B, TILE_BLOCK_2X2_SRC);
}
