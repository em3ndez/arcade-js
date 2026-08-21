// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintTileBlock2x2Above — copy four source bytes into a 2x2 tilemap block anchored at the
 * bottom-left, with the top row one tilemap row above the anchor.
 *
 * Source order is bottom-left, bottom-right, top-right, top-left. A pure leaf: reads src,
 * writes dst, calls nothing.
 *
 * LIVE-OUT: memory only (the four tiles); the caller reloads src and dst, so neither survives.
 */

const ROW_UP = -0x20;

export function paintTileBlock2x2Above(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  let cell = dst;
  mem8[cell] = mem8[src];        // bottom-left
  cell = cell + 1;
  mem8[cell] = mem8[src + 0x01]; // bottom-right
  cell = cell + ROW_UP;
  mem8[cell] = mem8[src + 0x02]; // top-right (one row up from the bottom-right)
  cell = cell - 1;
  mem8[cell] = mem8[src + 0x03]; // top-left
}
