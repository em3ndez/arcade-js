// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitEndStripAndSetHold  —  ROM 0x085b  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "no-more-frogs" tail of the end-of-board bonus countdown. When a board is cleared the game runs a
 *   bonus tally on the score-display field, draining the remaining time into points step by step. The
 *   instant that tally reaches zero, THIS routine paints the final label — a 9-tile graphic stacked up one
 *   VRAM column — and then freezes the countdown so the field holds its finished state on screen.
 *
 * WHERE IT SITS
 *   A short tail with a single caller: the per-frame bonus driver driveScoreDisplayCountdown (ROM 0x0870).
 *   That driver ticks a step counter down each frame and, on the frame the high byte SCORE_DISPLAY_COUNTER_HI
 *   (0x83dd) reads 0, hands off here instead of stepping the bar again. Below us it leans on one shared
 *   tilemap primitive, copyRunUpTileColumn (ROM 0x0028), called twice to draw the two strips. Attract never
 *   reaches this path (it is the end-of-a-real-board tail), so the equivalence test drives it from a crafted
 *   entry rather than from a live attract frame.
 *
 * LIVE-OUT
 *   Memory only. It writes nine tilemap cells (a 4-tile strip then a 5-tile strip up one column) and raises
 *   the hold flag. It returns nothing, and the caller reads no register back from it.
 */
import { NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, FIVE_TILE_STRIP_SRC, HOLD_FLAG } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

// Lengths of the two ROM tile runs, in tiles. The label is authored as two adjacent source strips rather
// than one so the game can reuse LAYOUT_SETUP_STRIP_SRC (0x2f6e) — the same 4-tile run the display-field
// layout blits elsewhere — for the bottom four cells, then stack a dedicated 5-tile run above it.
const FIRST_STRIP_TILES = 4;
const SECOND_STRIP_TILES = 5;

export function blitEndStripAndSetHold(m) {
  const { mem8 } = m;

  // ── Strip 1: the lower four tiles of the label ───────────────────────────────────────
  // Blit LAYOUT_SETUP_STRIP_SRC (0x2f6e) up the "no-more-frogs" column, whose top cell is
  // NO_MORE_FROGS_COLUMN_VRAM (0xaa51). copyRunUpTileColumn walks the destination pointer UP the column —
  // one on-screen row is 32 tile cells, so it steps −32 per tile — while reading the source run forward.
  // It hands back that destination pointer already stepped past the four cells it drew (0xaa51 − 4·32),
  // i.e. sitting on the next cell above the strip. We keep it to chain the second strip on top.
  const { hl: continuationTop } = copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, FIRST_STRIP_TILES);

  // ── Strip 2: the upper five tiles, continuing the same column ─────────────────────────
  // Blit FIVE_TILE_STRIP_SRC (0x2f12) from where the first blit left the destination, so the two runs join
  // into one unbroken 9-tile column climbing up from 0xaa51. Passing continuationTop as the destination is
  // exactly the ROM's trick of reusing the advanced HL pointer — no address is recomputed. This blit's
  // returned pointers are unused; only its tile writes matter.
  copyRunUpTileColumn(m, continuationTop, FIVE_TILE_STRIP_SRC, SECOND_STRIP_TILES);

  // ── Freeze the countdown ─────────────────────────────────────────────────────────────
  // Raise HOLD_FLAG (0x8004). The bonus driver driveScoreDisplayCountdown returns early on any frame this
  // flag is set, so setting it here stops the tally from running again: the finished label stays put and the
  // board sits in its completed state until the next board is set up. This is the routine's only side effect
  // beyond the tiles it drew.
  mem8[HOLD_FLAG] = 1;
}
