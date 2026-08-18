// SPDX-License-Identifier: GPL-3.0-only
/**
 * initDisplayFieldOnce  —  ROM 0x0aba  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The one-shot paint of the FIXED scaffolding for the end-of-board bonus display. Each time a board is
 *   cleared the game shows a draining time-bonus and a shrinking bar; the static parts of that field — a
 *   short tile strip, a tall solid-tile column, and the initial values of the bonus counter — are drawn
 *   here exactly once. Everything that then MOVES (the countdown, the bar animation, the score payout)
 *   is driven per-frame by driveScoreDisplayCountdown; this routine only lays the fixed ground it walks.
 *
 * WHERE IT SITS
 *   Two callers reach it, both at the top of a board layout: the first pass of driveScoreDisplayCountdown
 *   (0x0870), and the once-per-life start layout setUpPlayStartOnce. It self-guards on the layout-done
 *   cell loc_842d (0x842d) so the body runs at most once per board — a set guard falls straight through
 *   the first `return`. resetFrogObject (0x09aa) clears that guard when the frog is reset for the next
 *   board, which is what RE-ARMS this layout to fire again.
 *
 * LIVE-OUT
 *   Memory only. It writes VRAM tile cells (the strip + the column fill) and a handful of work-RAM
 *   scroll/state cells (the attribute shadow, the bonus arm re-arm cell, and the two countdown seeds).
 *   It returns nothing and leaves no register the caller reads.
 */
import {
  loc_842d, OBJRAM_COL3F_ATTR_SHADOW, loc_83e0, LAYOUT_SETUP_STRIP_VRAM, LAYOUT_SETUP_STRIP_SRC, LAYOUT_SETUP_COLUMN_VRAM, loc_83dc, loc_83de, SCROLL_STATE_INIT,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

// The layout draws two fixed tile runs in the same tilemap column: a short strip blitted UP into
// LAYOUT_SETUP_STRIP_VRAM (0xa8bf), and a tall solid fill run DOWN from LAYOUT_SETUP_COLUMN_VRAM (0xa8df,
// which is exactly one row — +0x20 — below the strip's top cell). Together they paint one contiguous band.
const STRIP_TILE_COUNT = 4;   // length of the ROM strip (LAYOUT_SETUP_STRIP_SRC 0x2f6e) blitted up the column
const FILL_TILE = 12;         // background tile stamped down the fill column
const FILL_ROWS = 15;         // number of rows in the solid fill
const ROW_STRIDE = 32;        // the tilemap is 32 cells wide, so +32 addresses steps exactly one row down

// Attribute (palette/colour select) written into the OBJRAM col-0x3f shadow OBJRAM_COL3F_ATTR_SHADOW
// (0x803f). That shadow is DMA'd to the hardware attribute byte 0xb03f each frame; display routines write
// it to colour column 0x3f — it is never read back as a flag.
const COL3F_ATTR = 3;

// Initial value of the displayed time-bonus byte loc_83de (0x83de). 0x60 == 96 decimal, but the display
// path reads it as packed BCD, so it shows as "60"; driveScoreDisplayCountdown BCD-decrements it toward 0.
const BONUS_DISPLAY_START = 0x60;

export function initDisplayFieldOnce(m) {
  const { mem8, mem16 } = m;

  // ── One-shot guard: has this board's field already been laid out? ─────────────────────
  // loc_842d (0x842d) is the layout-done latch. A non-zero value means the body already ran for this
  // board, so we bail before touching anything. Setting it to 1 immediately below is what makes every
  // later call this board a no-op; resetFrogObject clears it back to 0 to re-arm the layout next board.
  if (mem8[loc_842d] !== 0) return;
  mem8[loc_842d] = 1;

  // ── Colour column 0x3f for the bonus field ───────────────────────────────────────────
  // Set the OBJRAM col-0x3f attribute shadow (0x803f) so the far-right column carries this field's
  // palette; the vblank DMA copies it to the live attribute byte 0xb03f.
  mem8[OBJRAM_COL3F_ATTR_SHADOW] = COL3F_ATTR;

  // ── Re-arm the one-shot bonus-strip arm ───────────────────────────────────────────────
  // loc_83e0 (0x83e0) is armScoreBonusStrip's own one-shot guard (it prints the remaining bonus and cashes
  // it into the score, once). Clearing it here re-arms that arm so it can fire for this new board.
  mem8[loc_83e0] = 0;

  // ── Strip: blit a 4-tile run UP the strip column ──────────────────────────────────────
  // copyRunUpTileColumn is the rst 0x28 tilemap primitive (ROM 0x0028): it copies STRIP_TILE_COUNT bytes
  // from the flat ROM run LAYOUT_SETUP_STRIP_SRC (0x2f6e) into VRAM, stepping the destination UP one row
  // (−32) per byte, starting at LAYOUT_SETUP_STRIP_VRAM (0xa8bf). Draws the fixed top of the field.
  copyRunUpTileColumn(m, LAYOUT_SETUP_STRIP_VRAM, LAYOUT_SETUP_STRIP_SRC, STRIP_TILE_COUNT);

  // ── Fill: stamp a solid single-tile run DOWN the fill column ───────────────────────────
  // Fill FILL_ROWS rows of FILL_TILE (tile 12) starting at LAYOUT_SETUP_COLUMN_VRAM (0xa8df) and walking
  // DOWN the column (+ROW_STRIDE per row). This is the tall solid backdrop the draining bonus bar animates
  // over. (0xa8df is one row below the strip's top cell, so strip-up and fill-down abut in one column.)
  let cell = LAYOUT_SETUP_COLUMN_VRAM;
  for (let row = 0; row < FILL_ROWS; row++) {
    mem8[cell] = FILL_TILE;
    cell = cell + ROW_STRIDE;
  }

  // ── Seed the countdown state ──────────────────────────────────────────────────────────
  // loc_83dc (0x83dc) is a 16-bit scroll/state word; SCROLL_STATE_INIT (0x3c20) written little-endian puts
  // the per-step pace 0x20 (= 32 frames per step) in the low byte at 0x83dc and the step count 0x3c
  // (= 60 steps, the cell named SCORE_DISPLAY_COUNTER_HI) in the high byte at 0x83dd. loc_83de (0x83de) is
  // the displayed bonus byte the countdown draws and decrements. driveScoreDisplayCountdown consumes all
  // three from here.
  mem16[loc_83dc] = SCROLL_STATE_INIT;
  mem8[loc_83de] = BONUS_DISPLAY_START;
}
