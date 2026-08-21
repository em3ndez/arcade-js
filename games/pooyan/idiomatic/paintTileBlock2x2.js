// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintTileBlock2x2 — copy four source bytes into a 2x2 tilemap block anchored at the top-left.
 *
 * Stamps four consecutive source bytes into a 2x2 cell of the 0x20-wide tilemap: top row = dst,
 * dst+1; bottom row (one row below) = dst+0x20, dst+0x21. Source order is top-left, top-right,
 * bottom-RIGHT, bottom-left. A pure leaf: reads src, writes dst, calls nothing.
 *
 * LIVE-OUT: memory only (the four tiles). The walk ends src at src+3 and dst at dst+0x20, but the
 * caller restores DE (pop) and reloads HL, so neither survives for a reader.
 */
export function paintTileBlock2x2(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  // The column step is a page-local L++/L-- in the original; the real callers never straddle a
  // 256-byte page, so plain +1/-1 is exact for every address this routine sees.
  let cell = dst;
  mem8[cell] = mem8[src];
  cell = cell + 1;
  mem8[cell] = mem8[src + 0x01];
  cell = cell + 0x20;
  mem8[cell] = mem8[src + 0x02];
  cell = cell - 1;
  mem8[cell] = mem8[src + 0x03];
}
