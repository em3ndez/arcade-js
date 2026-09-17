// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileBlock — stamp a fixed 5-wide x 14-tall block of tile 0x10 into the tilemap at the
 * caller's top-left address (in HL). Fill value, width, height and row step are all constants;
 * the only input is the destination address.
 *
 * LIVE-OUT: memory-only — the 70 written tilemap cells.
 */

export function fillTileBlock(m, hl = m.regs.hl) {
  const { mem8 } = m;

  const TILE = 0x10;
  const WIDTH = 5;
  const ROWS = 0x0e;
  const ROW_BACKSTEP = 0x25; // net -0x20 per row = one tilemap row up at the same left edge

  let addr = hl;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < WIDTH; col++) {
      mem8[addr] = TILE;
      addr = (addr + 1) & 0xffff;
    }
    addr = (addr - ROW_BACKSTEP) & 0xffff;
  }
}
