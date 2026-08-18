// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTwoByTwoTileBlock  —  ROM 0x0695  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The shared "stamp a 2x2 tile block" primitive. Given a base tile cell, it paints the same marker
 *   tile (0x10) into a 2-wide, 2-tall square of the VRAM tilemap: the base cell, the cell to its right,
 *   and the two cells one screen row directly below. Frogger's tilemap is 32 tile columns wide, so the
 *   bottom row of the square sits at base+0x20 and base+0x21.
 *
 * WHERE IT SITS
 *   A leaf helper with a single caller: the board-complete finisher fillAllHomeSlotsAndAwardLife (ROM
 *   0x0670). When the all-frogs-home reveal countdown passes 16, that finisher resets the five home bays
 *   back to empty by calling this routine once per bay — passing each bay's fixed VRAM base
 *   (HOME_SLOT1_VRAM..HOME_SLOT5_VRAM) — before it clears HOME_COLUMN_STATE and awards the extra life.
 *   Tile 0x10 is the empty-home-bay graphic, so each call wipes one won bay's frog quad back to blank.
 *
 * WHERE THE BASE COMES FROM
 *   In the ROM the base cell is passed in register HL. The caller invokes this with an explicit base, so
 *   the `base` parameter defaults to m.regs.hl only to preserve the original register-passing contract
 *   (and to keep the equivalence-0695 oracle test, which pokes HL and calls with no argument, valid).
 *
 * LIVE-OUT
 *   Memory only. It writes four tilemap cells and returns nothing; no register the caller reads is left.
 */

// The marker tile written into every cell of the block: tile 0x10 (16) — the empty-home-bay graphic.
const MARKER_TILE = 0x10;

// One screen row of the tilemap is 32 tile cells wide (0x20 columns), so +32 steps straight down one
// row. In the ROM this same drop is done as HL += 0x1f after the top row's trailing HL++ (0x1f + 1 = 0x20).
const ROW_STRIDE = 32;

export function fillTwoByTwoTileBlock(m, base = m.regs.hl) {
  const { mem8 } = m;

  // ── Top row of the 2x2 block ──────────────────────────────────────────────────────────
  // Stamp the marker into the base cell and the cell immediately to its right (base, base+1).
  mem8[base] = MARKER_TILE;
  mem8[base + 1] = MARKER_TILE;

  // ── Bottom row of the 2x2 block ───────────────────────────────────────────────────────
  // Drop one full screen row (ROW_STRIDE = 32 cells) and stamp the matching pair directly below the top
  // row: base+0x20 and base+0x21. Together the four writes cover the whole 2x2 square.
  mem8[base + ROW_STRIDE] = MARKER_TILE;
  mem8[base + ROW_STRIDE + 1] = MARKER_TILE;
}
