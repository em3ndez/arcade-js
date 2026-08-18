// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitFourTileGroupColumn  —  ROM 0x19e2  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A static VRAM column stamp. It paints a fixed, non-scrolling 14-pair column of a repeating 2x2
 *   tile group into the tilemap, starting from a caller-supplied base address. The four tiles it lays
 *   down (72/73 across the top of each pair, 74/75 across the row just below) never change, so this is
 *   a constant "fill this 2-wide strip with a pattern" operation — a stamp, not a scroll.
 *
 * WHERE IT SITS
 *   A shared render helper the machine reuses wherever it needs a 2-tile-wide vertical strip painted:
 *     - the in-play status-row redraw and the game-over redraw blitGameOverLine (ROM 0x0f59) stamp it
 *       at the status-row base STATUS_ROW_VRAM_BASE (0xa850);
 *     - board-init renderFrogAndArmObjects (ROM 0x1952) stamps the home-marker column at
 *       FROG_RENDER_HOME_MARKER_VRAM (0xa85c).
 *   The Z80 caller hands the VRAM base in HL; in JS that arrives as the `dst` parameter, which defaults
 *   to m.regs.hl so a caller can either pass an explicit base or rely on the live HL register.
 *
 * LIVE-OUT
 *   Memory only — it writes tile cells into VRAM and nothing else. It returns nothing and leaves no
 *   register the caller reads.
 */

// The Frogger tilemap addresses one on-screen row every 32 bytes (0x20). Adding ROW_STRIDE to a VRAM
// pointer therefore steps straight down by one screen row; the two rows of a 2x2 pair sit exactly
// ROW_STRIDE apart.
const ROW_STRIDE = 32;

// 14 vertical pairs. Each pass paints two screen rows, so the finished strip is 28 rows tall — a full
// column down the region (status row / home-marker column) the caller pointed us at.
const ROWS = 14;

// The constant 2x2 tile group that repeats down the column. Top row of each pair = tiles 72/73
// (left/right, i.e. 0x48/0x49); the row one screen-row below = tiles 74/75 (left/right, 0x4a/0x4b).
// The tile numbers are fixed literals in the ROM, which is what makes this a static stamp.
const TILE_TOP_LEFT = 72;
const TILE_TOP_RIGHT = 73;
const TILE_BOTTOM_LEFT = 74;
const TILE_BOTTOM_RIGHT = 75;

export function blitFourTileGroupColumn(m, dst = m.regs.hl) {
  const { mem8 } = m;

  // Walk down the column one 2x2 pair per iteration. `dst` always points at the top-left cell of the
  // pair currently being painted.
  for (let row = 0; row < ROWS; row++) {
    // Top row of the pair: two adjacent tilemap cells at dst and dst+1.
    mem8[dst] = TILE_TOP_LEFT;
    mem8[dst + 1] = TILE_TOP_RIGHT;

    // Bottom row of the pair: the same two columns, one screen-row below (dst + 0x20 = dst + ROW_STRIDE).
    const lower = dst + ROW_STRIDE;
    mem8[lower] = TILE_BOTTOM_LEFT;
    mem8[lower + 1] = TILE_BOTTOM_RIGHT;

    // Advance past both rows just written to reach the next pair: two screen rows = 64 bytes (0x40).
    dst += 2 * ROW_STRIDE;
  }
}
