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
 *   - Ask the shared address helpers to turn that cell into its tilemap offset and
 *     the matching colour-RAM / video-RAM write cursors.
 *   - Copy the nine "GAME OVER" glyphs down the video column, one tilemap row apart.
 *   - Tail-jump into the colour-column filler, which tints all nine cells in one
 *     colour and returns straight to this routine's caller.
 *
 * THE FOUR LAYOUT HELPERS ARE STILL THE FROZEN ORACLE, reached through the registry.
 * Each returns through the machine's stack, so every call is bracketed with the
 * return address it expects to find there — the stack-side analogue of handing a
 * helper its input pointer, and a genuine oracle boundary. This game keeps the Z80
 * stack (which lives at the very top of work RAM) byte-identical to the hardware, so
 * reproducing those return-address pushes is what keeps this routine a faithful
 * drop-in: the work RAM, stack included, lands exactly as the oracle leaves it. (When
 * these helpers are later decompiled, the pushes dissolve into ordinary calls.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-48e5.test.js.
 * GATE:     strict — captured at the one real attract dispatch (0x48e5 runs once in a
 *           boot/attract run, reached from loc_472c in the game-over state, player
 *           count 0). Straight-line with no input-dependent branch, so that single
 *           dispatch exercises the whole path; oracle vs idiomatic diffed on clones of
 *           the entry. Full whole-dump equivalence, no exclusions; teeth twins caught.
 * LIVE-OUT: memory-only — the nine label cells in video RAM, the nine colour cells,
 *           the layout scratch (0x805a offset, 0x805e/0x8060 cursors), and the
 *           balanced work-stack. The routine tail-jumps into the colour filler, whose
 *           return goes to our caller. Because the oracle's stack pushes are
 *           reproduced, the stack, stack pointer, exit address, and register file all
 *           also land identical — the full contract, not just the memory minimum.
 * NAMES:    TILE_COL / TILE_ROW from ram.js — the tile cell fed to the address calc.
 *           0x8057 kept local (FILL_ATTR): ram.js proposes BOARD_MODE for it, but here
 *           it is unambiguously the label's colour byte, so a local role name is used
 *           rather than a misfit import (matches the sibling loc_4894). 0x8055
 *           (CELL_COUNT, the row count) and the ROM glyph source (0x49a5) are not
 *           named in ram.js.
 */
import { TILE_COL, TILE_ROW } from "./ram.js";

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
  // and video-RAM (0x8060) write cursors. (Each pushed address is where that
  // still-oracle helper's own return lands.)
  m.push16(0x48f2);
  m.call(0x3dae);
  m.push16(0x48f5);
  m.call(0x3dc9);

  // Colour attribute for the label, and the nine-row run shared by copy and fill.
  mem.write8(FILL_ATTR, 6);
  mem.write8(CELL_COUNT, 9);

  // Copy the nine "GAME OVER" glyphs down the video column.
  m.regs.ix = GAME_OVER_SOURCE; // the source pointer the copy helper reads
  m.push16(0x4906);
  m.call(0x3dea);

  // Tail-jump into the colour-column filler: it tints all nine cells and its return
  // unwinds straight to our caller, so this is drawGameOverLabel's exit.
  return m.call(0x3e01);
}
