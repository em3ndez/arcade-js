// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileBlock — stamp a fixed 5-wide × 14-tall block of tile 0x10 into the
 * tilemap at the caller's address.
 *
 * A shared screen-region fill, used by the game-over and player-switch render
 * sequences and by the board-start intro setup. The caller leaves the top-left
 * tilemap cell in the address register; this lays tile 0x10 across 5 cells, then
 * walks the pointer one whole tilemap row up and back to the same left edge, and
 * repeats for 14 rows — a 5×14 rectangle of 0x10.
 *
 *   - The fill value (0x10), the width (5), the height (14) and the row step are
 *     all CONSTANTS baked into the routine. The only input is the destination
 *     address.
 *   - Each row writes 5 cells, then steps the pointer back by 0x25. Net −0x20 per
 *     row, i.e. one tilemap row up at the same left edge (the map is 0x20 cells
 *     wide).
 *
 * A LEAF: calls nothing and READS NO MEMORY — a pure writer whose whole input is
 * that one address. It writes only the 70 tilemap cells.
 *
 * LIVE-OUT: memory-only — the 70 written tilemap cells.
 */

export function fillTileBlock(m) {
  const { regs, mem } = m;

  const TILE = 0x10; // fill tile code, loaded once for the whole block
  const WIDTH = 5; // cells written per row
  const ROWS = 0x0e; // 14 rows
  const ROW_BACKSTEP = 0x25; // the pointer steps back 0x25 after each 5-cell run

  let addr = regs.hl; // caller-supplied top-left tilemap cell (live-in)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < WIDTH; col++) {
      mem.write8(addr, TILE);
      addr = (addr + 1) & 0xffff;
    }
    addr = (addr - ROW_BACKSTEP) & 0xffff; // one tilemap row up, back at the left edge
  }
}
