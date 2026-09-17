// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoTileBands — from the tilemap row base in HL, lay tile 0xFD across four cells, step over
 * a 28-cell gap, then lay tile 0xFC across four more — eight writes, ending 36 cells past the
 * base. Straight-line; the only input is the base pointer.
 *
 * LIVE-OUT: memory-only — the eight tilemap cells.
 */

export function stampTwoTileBands(m, hl = m.regs.hl) {
  const { mem8 } = m;

  let addr = hl;

  for (let i = 0; i < 4; i++) {
    mem8[addr] = 0xfd;
    addr = (addr + 1) & 0xffff;
  }

  addr = (addr + 0x1c) & 0xffff;

  for (let i = 0; i < 4; i++) {
    mem8[addr] = 0xfc;
    addr = (addr + 1) & 0xffff;
  }
}
