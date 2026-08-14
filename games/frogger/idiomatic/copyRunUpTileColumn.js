// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyRunUpTileColumn — copy a run of bytes up a tilemap column.
 * Copies `count` bytes from the source into the destination, stepping the destination up one
 * tilemap row (back 32 cells) after each byte while the source advances. A count of zero copies 256.
 * LIVE-OUT: memory, plus the advanced destination and source pointers the caller reads back.
 */
export function copyRunUpTileColumn(m, dst = m.regs.hl, src = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;
  let d = dst;
  let s = src;
  let n = count;
  do {
    mem8[d] = mem8[s];
    d = (d - 32) & 0xffff;
    s = (s + 1) & 0xffff;
    n = (n - 1) & 0xff;
  } while (n !== 0);
  m.regs.hl = d;
  m.regs.de = s;
}
