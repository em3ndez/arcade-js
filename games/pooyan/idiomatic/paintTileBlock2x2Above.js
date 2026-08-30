// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintTileBlock2x2Above — stamp a 2x2 block of tiles into the tilemap, anchored at the
 * bottom-left, with the block's top row sitting one tilemap row ABOVE the anchor.
 *
 * ROM 0x780f. Grounding: [seen].
 *
 * The background tilemap is 0x20 (32) tile codes wide, so the cell one row above any given cell
 * sits exactly 0x20 bytes earlier. This is the mirror of paintTileBlock2x2: instead of growing
 * a square downward from a top-left corner, it grows upward from a bottom-left corner. Given a
 * destination address treated as the bottom-left of the block:
 *
 *     dst-0x20   dst-0x1f     <- the row directly above (0x20 = one tilemap row)
 *     dst        dst+1        <- bottom row, at the anchor
 *
 * The four source bytes are consumed in order and land as: bottom-left, bottom-right,
 * top-right, then top-left. The original walks the corners across the bottom, up the right
 * side by one row, then back across the top, which is why the fill is not a raster order.
 * Writing upward suits callers that place a block relative to a baseline (a floor or a shelf)
 * rather than a ceiling.
 *
 * A pure leaf: it reads the source run, writes the four tiles, and calls nothing.
 *
 * LIVE-OUT: memory only — the four painted tiles. The caller reloads both the source run and
 * the destination afterward, so neither pointer survives.
 */

// One tilemap row up: the map is 0x20 wide, so subtracting 0x20 moves straight up a row. The
// original holds this as 0xffe0 (-0x20) in a register and adds it to the pointer.
const ROW_UP = -0x20;

export function paintTileBlock2x2Above(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  // Bottom-left corner: the anchor cell itself takes the first source byte.
  let cell = dst;
  mem8[cell] = mem8[src];        // bottom-left

  // Bottom-right: step one column to the right (+1) and take the second source byte. A 2x2
  // block never crosses a 256-byte page, so the plain +1 on the address is exact here.
  cell = cell + 1;
  mem8[cell] = mem8[src + 0x01]; // bottom-right

  // Top-right: rise one tilemap row (ROW_UP = -0x20), landing directly above the bottom-right
  // corner, and take the third source byte.
  cell = cell + ROW_UP;
  mem8[cell] = mem8[src + 0x02]; // top-right (one row up from the bottom-right)

  // Top-left: step one column back to the left (-1) and take the fourth source byte, closing
  // the square directly above the anchor.
  cell = cell - 1;
  mem8[cell] = mem8[src + 0x03]; // top-left
}
