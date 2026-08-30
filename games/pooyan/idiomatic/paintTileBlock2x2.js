// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintTileBlock2x2 — stamp a 2x2 block of tiles into the tilemap, anchored at the top-left.
 *
 * ROM 0x0a40. Grounding: [seen].
 *
 * The video hardware draws the background from a tilemap laid out 0x20 (32) tile codes to a
 * row, so the tile one row below any cell sits exactly 0x20 bytes further on. This routine
 * takes a four-byte source run and paints it into a square of four adjacent cells whose
 * top-left corner is the destination address:
 *
 *     dst        dst+1        <- top row
 *     dst+0x20   dst+0x21     <- the row directly below (0x20 = one tilemap row)
 *
 * The four source bytes are consumed in order, and they land in the block in this sequence:
 * top-left, top-right, bottom-RIGHT, then bottom-left. The bottom row is therefore filled
 * right-to-left, which is a consequence of how the original walks the corners (step across the
 * top, drop down a row on the right, step back across the bottom) rather than a raster order.
 *
 * A pure leaf: it reads the source run, writes the four tiles, and calls nothing.
 *
 * LIVE-OUT: memory only — the four painted tiles. The original ends with the source pointer
 * advanced by four (it read four consecutive bytes) and the tilemap pointer resting on the
 * bottom-left cell, but every caller restores the source pointer and reloads the destination,
 * so neither survives for a reader.
 */
export function paintTileBlock2x2(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  // Top-left corner: the anchor cell itself takes the first source byte.
  let cell = dst;
  mem8[cell] = mem8[src];

  // Top-right: step one column to the right (+1) and take the second source byte. The original
  // advances the low byte of the tilemap pointer alone here; a real 2x2 block never straddles a
  // 256-byte page boundary, so a full +1/-1 on the address is exact for every case this sees.
  cell = cell + 1;
  mem8[cell] = mem8[src + 0x01];

  // Bottom-right: drop straight down one tilemap row (+0x20) and take the third source byte.
  // 0x20 is the map width, so this reaches the cell directly beneath the top-right corner.
  cell = cell + 0x20;
  mem8[cell] = mem8[src + 0x02];

  // Bottom-left: step one column back to the left (-1) and take the fourth source byte, closing
  // the square directly beneath the anchor.
  cell = cell - 1;
  mem8[cell] = mem8[src + 0x03];
}
