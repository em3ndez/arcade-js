// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawIndexedTileBlock — look a 2x2 tile-block code up by index, then stamp that block.
 *
 * WHAT IT IS
 *   Turns a small block index into an on-screen 2x2 tile square. The block's four consecutive tile codes
 *   are not stored per-figure; instead a one-byte seed code lives in the ROM tile-block source table
 *   TILE_BLOCK_TABLE (0x215b), and the index picks which entry to draw. The picked seed is then stamped
 *   as a 2x2 block at the destination cell the caller staged.
 *
 * ROLE IN THE MACHINE
 *   A two-step composite in the tile-drawing kit:
 *     1. fetchIndexedTableByte (RST-20, 0x0020) does the indexed fetch — HL = TILE_BLOCK_TABLE + index
 *        (carrying into the high byte), then reads the seed byte at that address.
 *     2. drawTileBlock2x2AtDe (0x214a) is the pointer-swap adapter: it exchanges the working pointers so
 *        the destination staged in the alternate (DE) register becomes the draw target, then stamps the
 *        2x2 block (four codes seed..seed+3, laid as a square) at that VRAM cell.
 *   It is the non-negative-index arm reached from drawSelectedTileBlockOrFallback (the signed block
 *   selector); a negative selector takes the fixed-fallback path instead.
 *
 * ROM 0x2146.  Grounding: [seen].
 *
 * LIVE-OUT: whatever drawTileBlock2x2AtDe returns (the 2x2 block painted at the DE-staged VRAM cell).
 */
import { TILE_BLOCK_TABLE } from "./names.js";
import { fetchIndexedTableByte } from "./fetchIndexedTableByte.js";
import { drawTileBlock2x2AtDe } from "./drawTileBlock2x2AtDe.js";

export function drawIndexedTileBlock(m, index = m.regs.a) {
  // Fetch the block's seed tile code from the ROM block table at position `index`.
  const tile = fetchIndexedTableByte(m, index, TILE_BLOCK_TABLE);
  // Stamp the 2x2 block from that seed at the destination the caller staged in DE.
  return drawTileBlock2x2AtDe(m, tile);
}
