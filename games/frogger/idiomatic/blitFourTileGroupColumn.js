// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitFourTileGroupColumn — blit a 14-row column of the 4-tile group into VRAM from the caller-supplied base:
 * two tiles across the top row of each pair, two across the row below it.
 * LIVE-OUT: memory-only.
 */
const ROWS = 14;
const ROW_STRIDE = 32;
const TILE_TOP_LEFT = 72;
const TILE_TOP_RIGHT = 73;
const TILE_BOTTOM_LEFT = 74;
const TILE_BOTTOM_RIGHT = 75;

export function blitFourTileGroupColumn(m, dst = m.regs.hl) {
  const { mem8 } = m;

  for (let row = 0; row < ROWS; row++) {
    mem8[dst] = TILE_TOP_LEFT;
    mem8[(dst + 1)] = TILE_TOP_RIGHT;
    const lower = dst + ROW_STRIDE;
    mem8[lower] = TILE_BOTTOM_LEFT;
    mem8[(lower + 1)] = TILE_BOTTOM_RIGHT;
    dst = dst + 2 * ROW_STRIDE;
  }
}
