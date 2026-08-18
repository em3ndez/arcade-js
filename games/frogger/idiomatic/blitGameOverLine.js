// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitGameOverLine  —  ROM 0x0f59  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The two-step redraw of the "GAME OVER" banner line. It first wipes the status-row tilemap column
 *   back to its blank background pattern, then stamps the fixed 9-tile "GAME OVER" glyph string on top.
 *   Both steps write nothing but VRAM tile cells — the visible result is the GAME OVER text appearing on
 *   a freshly cleared line.
 *
 * WHERE IT SITS
 *   The first thing the intro / game-over entry runIntroTimerThenInitGame (ROM 0x2xxx) does: paint the
 *   banner, then it plays the two game-over jingles (0x0c, 0x0d) and spins the INTRO_TIMER (0x83c5) delay
 *   down. Clearing before stamping matters because the status-row column may still hold in-play HUD
 *   content from the round that just ended; the clear guarantees the string lands on a clean strip.
 *
 * LIVE-OUT
 *   Memory only (VRAM). It returns nothing and leaves no register the caller reads — both callees are
 *   memory-only stamps invoked purely for their side effects.
 */
import { STATUS_ROW_VRAM_BASE, NINE_TILE_STRING_VRAM, NINE_TILE_STRING_SRC } from "./names.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

// The banner reads "GAME OVER" — nine glyph tiles, so the string blit copies exactly 9 source bytes.
// The count matches the width baked into the two NINE_TILE_STRING_* cell names below.
const GAME_OVER_STRING_TILES = 9;

export function blitGameOverLine(m) {
  // ── Step 1: clear the status-row column ──────────────────────────────────────────────
  // Repaint the status-row column at STATUS_ROW_VRAM_BASE (0xa850) with the constant 2x2 background
  // tile-group (tiles 72/73 over 74/75). blitFourTileGroupColumn is a static stamp — it always lays the
  // same blank pattern — so running it over the status row erases whatever HUD/score content was left
  // there and gives the GAME OVER text a clean strip to sit on.
  blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE);

  // ── Step 2: stamp the "GAME OVER" glyph string ───────────────────────────────────────
  // Copy the fixed 9-tile string from its ROM source NINE_TILE_STRING_SRC (0x2f0e) UP the VRAM column at
  // NINE_TILE_STRING_VRAM (0xaa70). In the Z80 this is the `rst 0x28` restart — the hardware call vector
  // for the 0x0028 primitive copyRunUpTileColumn — which walks the destination backward one 32-cell
  // tilemap row per byte, so a linear ROM run paints as a vertical column of glyphs.
  copyRunUpTileColumn(m, NINE_TILE_STRING_VRAM, NINE_TILE_STRING_SRC, GAME_OVER_STRING_TILES);
}
