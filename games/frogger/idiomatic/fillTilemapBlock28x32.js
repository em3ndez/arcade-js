// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTilemapBlock28x32  —  ROM 0x0766  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A play-field clear primitive. Frogger's background is a 32x32 grid of tile cells living in VRAM
 *   (VRAM_BASE 0xa800 through 0xabff, one byte per cell). This routine stamps the blank tile 0x10 into a
 *   28-wide by 32-tall rectangle of that grid — it wipes the play area to blank while deliberately
 *   stepping over a 4-column margin, so the score/status column down one edge of the screen is preserved
 *   rather than erased.
 *
 * WHERE IT SITS
 *   A shared setup helper, called whenever a screen needs its play field reset to blank:
 *     - renderMode2IntroScreen (ROM 0x2d88) — building the mode-2 intro/attract screen,
 *     - initInPlayBoardOnce   (ROM 0x0d4c) — the one-shot in-play board setup, and
 *     - the attract-demo phase-0 seed.
 *   Its sibling clearTilemapToTile16 wipes ALL 1024 cells (the rst 0x38 whole-screen blank); this one is
 *   the narrower "clear the play area, keep the HUD margin" variant.
 *
 * LIVE-OUT
 *   Memory only. It writes tile 0x10 into 28 cells across each of 32 rows and returns nothing; it leaves
 *   no register the caller reads. Grounded [seen] via MAME write-tap: it writes 0x10 at pc=0770 during
 *   screen setup.
 */
import { TILEMAP_FILL_BASE_28X32 } from "./names.js";

// The blank/background tile. Every cell in the cleared block is set to this. mechanisms.md and names.js
// both refer to it as "tile 0x10", the same blank tile the whole-screen wipe uses.
const FILL_TILE = 0x10;

// Block geometry. The fill walks ROWS rows; in each row it stamps CELLS_PER_ROW cells and then steps over
// ROW_SKIP cells. CELLS_PER_ROW + ROW_SKIP == 32, which is exactly the tilemap's row stride (32 cells per
// physical VRAM row) — so the skip is what carries the pointer across the 4-column status/HUD margin and
// lands it precisely on the head of the next row.
const ROWS = 32;
const CELLS_PER_ROW = 28;
const ROW_SKIP = 4;

export function fillTilemapBlock28x32(m) {
  const { mem8 } = m;

  // Walking write pointer into VRAM, starting at the fixed block origin TILEMAP_FILL_BASE_28X32 (0xa802) —
  // the top-left cell of the 28x32 block, two cells into the tilemap from VRAM_BASE (0xa800).
  let dst = TILEMAP_FILL_BASE_28X32;

  for (let row = 0; row < ROWS; row++) {
    // Stamp the blank tile across the 28 play-field cells of this row, advancing one cell at a time.
    for (let cell = 0; cell < CELLS_PER_ROW; cell++) {
      mem8[dst] = FILL_TILE;
      dst = dst + 1;
    }

    // Skip the 4-cell status margin at the end of this VRAM row. Because 28 + 4 = one full 32-cell row
    // stride, dst now points at the first play-field cell of the next row, leaving those 4 HUD cells
    // untouched.
    dst = dst + ROW_SKIP;
  }
}
