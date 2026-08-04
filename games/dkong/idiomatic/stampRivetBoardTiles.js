// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardTiles — stamp a fixed 2-tile motif into eight video-RAM cells during
 * 100m-rivet board setup.
 *
 * Called during board setup, and only on the rivet board. It walks an eight-entry
 * little-endian pointer table and, into each destination cell pair, writes the two fixed tile
 * codes 0xB8 then 0xB7. The eight destinations are two groups of four video-RAM cells at a
 * stride of five columns — a fixed piece of the rivet board's static graphics.
 *
 * INPUT-INDEPENDENT: it reads only its own table and constants, takes no argument, and every
 * store lands a fixed value, so its 16 video-RAM writes are the same regardless of prior
 * machine state. A LEAF — it calls nothing.
 *
 * LIVE-OUT: memory-only — the 16 video-RAM bytes.
 */

// The destination table: eight little-endian video-RAM pointers, laid out as two groups of
// four cells five columns apart. It is code-space data, not work RAM, so it stays a bare
// constant here.
const DEST_TABLE = 0x0d17;

export function stampRivetBoardTiles(m) {
  const { mem } = m;

  // Walk the eight destination pointers; into each cell pair, stamp 0xB8 then 0xB7.
  for (let i = 0, ptr = DEST_TABLE; i < 8; i++, ptr += 2) {
    const dest = mem.read8(ptr) | (mem.read8(ptr + 1) << 8); // little-endian VRAM pointer
    mem.write8(dest, 0xb8); //                first tile
    mem.write8((dest + 1) & 0xffff, 0xb7); // second tile, one code lower
  }
}
