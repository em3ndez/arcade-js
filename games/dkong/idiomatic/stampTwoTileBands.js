// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoTileBands — stamp two 4-cell tile bands (0xFD then 0xFC) into a tilemap row,
 * given the row-base pointer.
 *
 * Handed HL at a tilemap row base, it lays tile code 0xFD across four consecutive cells
 * (base..base+3), steps forward over a 28-cell gap, then lays tile code 0xFC across four
 * more cells (base+0x20..base+0x23) — eight writes in all, ending 36 cells past the base.
 * Both run lengths are a fixed 4 and both tile codes are constants, so there is no
 * data-dependent branch: one straight-line path whose only input is the base pointer.
 *
 * It is invoked twice from the 100m rivet-board setup path, at two fixed row bases. A LEAF —
 * it calls nothing, and HL is a caller-supplied tilemap pointer rather than a named cell.
 *
 * LIVE-OUT: memory-only — the eight tilemap cells.
 */

export function stampTwoTileBands(m) {
  const { regs, mem } = m;

  // HL is handed in at the tilemap row base.
  let addr = regs.hl;

  // Band 1: tile 0xFD across four consecutive cells.
  for (let i = 0; i < 4; i++) {
    mem.write8(addr, 0xfd);
    addr = (addr + 1) & 0xffff;
  }

  // Step over the 28-cell gap.
  addr = (addr + 0x1c) & 0xffff;

  // Band 2: tile 0xFC across four consecutive cells.
  for (let i = 0; i < 4; i++) {
    mem.write8(addr, 0xfc);
    addr = (addr + 1) & 0xffff;
  }
}
