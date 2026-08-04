// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileRowPair — stamp a fixed two-row motif into the background tilemap: 17 cells of one
 * tile along a row, then 17 cells of a second tile on the row directly below it.
 *
 * A board-setup helper, used to lay a piece of fixed scenery into the background of the
 * elevator board. The caller supplies the top-left cell to write from; everything else — both
 * tile codes and both 17-cell counts — is fixed here.
 *
 *   - the first 17 consecutive cells from the caller's address get the first tile;
 *   - the pointer then skips 15 cells. The tilemap is 32 cells wide and laid out row by row, so
 *     17 written plus 15 skipped is exactly one row: the walk lands on the SAME column, one row
 *     further on;
 *   - the next 17 consecutive cells get the second tile, sitting directly beneath the first run.
 *
 * The walk is done with a local, not by moving the caller's pointer, because nothing reads that
 * pointer back afterwards.
 *
 * LIVE-OUT: memory-only — 34 tilemap cells, 17 of each tile.
 */

export function fillTileRowPair(m) {
  const { regs, mem } = m;

  // The caller's pointer: the top-left cell of the two-row motif.
  let addr = regs.hl;

  // Row 1: 17 cells of the first tile.
  for (let i = 0; i < 0x11; i++) {
    mem.write8(addr, 0xfd);
    addr = (addr + 1) & 0xffff;
  }

  // Skip the 15 cells left in the row: 17 written plus 15 skipped is the 32-cell row
  // width, so this lands on the same column one row further on.
  addr = (addr + 0x0f) & 0xffff;

  // Row 2: 17 cells of the second tile, directly beneath row 1.
  for (let i = 0; i < 0x11; i++) {
    mem.write8(addr, 0xfc);
    addr = (addr + 1) & 0xffff;
  }
}
