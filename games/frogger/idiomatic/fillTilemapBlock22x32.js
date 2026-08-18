// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTilemapBlock22x32  —  ROM 0x0781  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A tilemap paint primitive: it flood-fills a 22-wide by 32-tall rectangular block of the character
 *   tilemap with the blank background tile 0x10. It is one of the family of "clear a region of VRAM"
 *   helpers the machine reuses to build a screen from scratch, differing from its siblings only in the
 *   block's width and starting cell (the 28-wide variant clears the play area; this 22-wide variant
 *   clears a narrower window and leaves a wider right-hand margin untouched).
 *
 * WHERE IT SITS
 *   Called once, near the top of renderMode3ScoreRankingScreen (ROM 0x0bb3), the routine that draws the
 *   attract-mode "SCORE RANKING" screen. This fill lays down the blank canvas — every cell reset to the
 *   background tile — onto which that caller then stamps the header, the five ranked high scores, and the
 *   " PTS" suffixes. It does not run during ordinary play; in a plain attract loop the mode-3 screen is
 *   never reached, which is why its equivalence test drives it over crafted machine states rather than a
 *   captured live dispatch.
 *
 * GEOMETRY
 *   The character tilemap is 32 cells wide by 32 cells tall (1024 cells) based at VRAM 0xa800. This block
 *   starts at cell 8 of the first row — TILEMAP_FILL_BASE_22X32 (0xa808) — and, per row, writes 22 cells
 *   then advances 10 more without writing. Since 22 + 10 = 32 = one full tilemap row, the write cursor
 *   lands on the same column of the next row every pass: the routine paints columns 8..29 of all 32 rows
 *   and leaves the remaining 10 cells of each row (the status margin) as they were.
 *
 * LIVE-OUT
 *   Memory only. It writes 22*32 = 704 tilemap cells and touches nothing else — no register the caller
 *   reads, no return value.
 */
import { TILEMAP_FILL_BASE_22X32 } from "./names.js";

// 0x10 — the blank background character. mechanisms.md calls this "the blank tile 0x10"; every
// region-clear primitive in this family writes it to mean "erased to background".
const FILL_TILE = 16;

// The block's shape. ROWS is the tilemap's full height (32 cells); CELLS_PER_ROW (22) is how many cells
// of each row this narrower block actually paints.
const ROWS = 32;
const CELLS_PER_ROW = 22;

// The per-row cursor jump AFTER the 22 painted cells. 10 = 32 (full tilemap row) − 22 (painted), so this
// skip carries the cursor across the unpainted right margin and onto the first painted cell of the next
// row. The 22-wide block and its 10-wide untouched margin are exactly this decomposition of the row.
const ROW_SKIP = 10;

export function fillTilemapBlock22x32(m) {
  const { mem8 } = m;

  // The destination VRAM cursor. It starts at the fixed block origin TILEMAP_FILL_BASE_22X32 (0xa808) and
  // marches forward cell by cell; because 22 + 10 = one full row, it never needs a per-row reset — it
  // simply walks straight through the tilemap, painting a run and stepping over the margin, row after row.
  let dst = TILEMAP_FILL_BASE_22X32;

  for (let row = 0; row < ROWS; row++) {
    // ── Paint one row of the block ───────────────────────────────────────────────────────
    // Write the blank tile into 22 consecutive cells starting at the current cursor. These are the
    // block's columns for this row (columns 8..29 of the 32-wide tilemap).
    for (let cell = 0; cell < CELLS_PER_ROW; cell++) {
      mem8[dst] = FILL_TILE;
      dst++;
    }

    // ── Step across the right margin to the next row ─────────────────────────────────────
    // Advance past the 10 cells this block does not own, landing the cursor on the first painted cell of
    // the row below. On the final iteration this overshoots one row past the block, which is harmless
    // because the loop ends here.
    dst += ROW_SKIP;
  }
}
