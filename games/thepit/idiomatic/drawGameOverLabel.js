// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGameOverLabel — stamp the nine-character "GAME OVER" label down its HUD
 * text column.  ROM 0x48e5.
 *
 * The HUD redraw (loc_472c) repaints both players' score displays and then, from
 * the count of players still in the game, picks which status label to draw: with
 * no player left active — player count 0, the game-over state — it draws this one.
 * The label's glyphs are a fixed nine-byte run of character codes in ROM that
 * spell "GAME OVER"; the copy helper reads that run from its top downward, so the
 * pointer it is handed is the address of the run's last byte.
 *
 * The work is four fixed, straight-line steps:
 *   - Name the label's first tile cell: screen column 1, row 12.
 *   - Turn that cell into its tilemap offset (rowColToTileOffset), then into the
 *     matching colour-RAM / video-RAM write cursors (deriveTileWriteCursors).
 *   - Copy the nine "GAME OVER" glyphs down the video column, one tilemap row apart.
 *   - Tint all nine cells in one colour (fillColourColumn), which is this routine's
 *     last act.
 *
 * THE COPY HELPER (ROM 0x3dea) IS STILL THE FROZEN ORACLE, reached through the
 * registry. It reads its glyph source from a pointer register and returns through the
 * machine's stack, so its call is handed both that source pointer and the return
 * address it expects to find — a genuine oracle boundary. This game keeps the Z80
 * stack (which lives at the top of work RAM) byte-identical to the hardware, so
 * reproducing that copy helper's return-address push keeps the work RAM, stack
 * included, exactly as the oracle leaves it. The three address/fill helpers are
 * already decompiled, so they are called directly with no stack framing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-48e5.test.js.
 * GATE:     observable equivalence, captured at the one real attract dispatch (0x48e5
 *           runs once in a boot/attract run, reached from loc_472c in the game-over
 *           state, player count 0). Straight-line with no input-dependent branch, so
 *           that single dispatch exercises the whole path; oracle vs idiomatic diffed
 *           on clones of the entry over the work/video/colour RAM the routine writes,
 *           plus pc + SP after the routine's return is modelled. Teeth twins caught.
 * LIVE-OUT: memory-only — the nine label cells in video RAM, the nine colour cells,
 *           and the layout scratch (0x805a offset, 0x805e/0x8060 cursors). Unlike the
 *           oracle it does not perform the tail helper's own return, so its exit pc and
 *           stack pointer are the caller's to close; the gate models that one return to
 *           line them up with the oracle before comparing.
 * NAMES:    TILE_COL / TILE_ROW from ram.js — the tile cell fed to the address calc.
 *           0x8057 kept local (FILL_ATTR): ram.js proposes BOARD_MODE for it, but here
 *           it is unambiguously the label's colour byte, so a local role name is used
 *           rather than a misfit import (matches the sibling loc_4894). 0x8055
 *           (CELL_COUNT, the row count) and the ROM glyph source (0x49a5) are not
 *           named in ram.js.
 */
import { TILE_COL, TILE_ROW } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

// The colour attribute the whole label is painted in. ram.js proposes BOARD_MODE for
// 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_ATTR = 0x8057;

// How many cells the copy and the colour fill each write (the nine characters).
const CELL_COUNT = 0x8055;

// ROM source of the nine "GAME OVER" glyphs (G,A,M,E,space,O,V,E,R at 0x499d..0x49a5).
// The copy helper walks it downward from the top, so it is handed the last byte.
const GAME_OVER_SOURCE = 0x49a5;

export function drawGameOverLabel(m) {
  const { mem } = m;

  // The label's first character sits at screen column 1, row 12.
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);

  // Turn that tile cell into its tilemap offset, then into the colour-RAM (0x805e)
  // and video-RAM (0x8060) write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour attribute for the label, and the nine-row run shared by copy and fill.
  mem.write8(FILL_ATTR, 6);
  mem.write8(CELL_COUNT, 9);

  // Copy the nine "GAME OVER" glyphs down the video column. The copy helper (ROM 0x3dea)
  // is still the frozen oracle: it reads its source from the pointer register and returns
  // through the stack, so it is handed the source pointer and its own return slot.
  m.regs.ix = GAME_OVER_SOURCE;
  m.push16(0x4906);
  m.call(0x3dea);

  // Tint all nine cells in one colour. In the oracle this was a tail-jump into the colour
  // filler whose own return unwound to the caller; called directly, it paints the column
  // and returns here, so this is drawGameOverLabel's last act.
  return fillColourColumn(m);
}
