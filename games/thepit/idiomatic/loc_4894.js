// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4894 — paint one fixed 9-cell HUD/text panel at column 6, row 10.  ROM 0x4894.
 *
 * Reached from the periodic-housekeeping arm of the movement core (loc_03e8) once a
 * counter runs out, so this is a periodic redraw of one fixed on-screen panel.
 *
 * Draws a single vertical panel column made of two stacked fields:
 *   - the top cell shows a live value read from a work-RAM slot (it changes as the
 *     game runs),
 *   - the next eight cells show a fixed label — a cap glyph followed by seven glyphs
 *     read out of a ROM table.
 *
 * It works by first naming the target cell (column 6, row 10) and asking the shared
 * address helpers to turn that into the tilemap offset and the matching colour-RAM /
 * video-RAM write cursors. Then it drives the two copy/fill helpers to stamp the
 * glyphs down the video column — the video cursor is carried forward between them, so
 * the label continues directly below the live value — and finally tail-jumps into the
 * colour-column filler, which tints the run in one colour and returns to this
 * routine's caller.
 *
 * Unlike the sibling panel painters, this one does NOT reset the cell count before
 * the colour fill: it leaves the label field's count of eight in place, so the colour
 * run covers eight cells rather than the full nine — the top live-value cell keeps
 * whatever colour it already had.
 *
 * THE FIVE LAYOUT HELPERS ARE STILL THE FROZEN ORACLE, reached through the registry.
 * Each returns through the machine's stack, so every call is bracketed with the return
 * address it expects to find there — the stack-side analogue of handing a helper its
 * input pointer, and a genuine oracle boundary. This game keeps the Z80 stack (which
 * lives at the very top of work RAM) byte-identical to the hardware, so reproducing
 * those return-address pushes is what keeps this routine a faithful drop-in: the work
 * RAM, stack included, lands exactly as the oracle leaves it. (When these helpers are
 * later decompiled, the pushes dissolve into ordinary calls.)
 *
 * Name kept as loc_4894: it is clearly a fixed-panel painter, but which specific field
 * it draws is not pinned (the label glyphs are ROM tile codes, not decoded), and it is
 * one of a family of near-identical panel painters — below the bar for an English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4894.test.js.
 * GATE:     strict — captured at the real attract dispatch (0x4894 runs once during a
 *           boot/attract run, reached from loc_03e8 when its housekeeping counter hits
 *           zero), oracle vs idiomatic diffed on clones of that entry, plus a sweep of
 *           the one state-dependent input (the live top-cell value at 0x8000). Full
 *           whole-dump equivalence, no exclusions; teeth twins caught.
 * LIVE-OUT: memory-only — the panel's tilemap + colour cells and the layout scratch
 *           (0x805a offset, 0x805e/0x8060 cursors). The routine tail-jumps into the
 *           colour filler, whose return goes to our caller. Because the oracle's stack
 *           pushes are reproduced at the call boundary, the stack, stack pointer, exit
 *           address, and register file all also land identical — the full contract, not
 *           just the memory-only minimum.
 * NAMES:    TILE_COL, TILE_ROW from ram.js. 0x8057 kept local (FILL_ATTR) — ram.js
 *           proposes BOARD_MODE for that address, but here it is unambiguously the
 *           panel's colour byte, so a local role name is used instead of a misfit
 *           import. 0x8055 (CELL_COUNT, per-field cell count) and the source pointers
 *           0x8000 / 0x496d are not named in ram.js.
 */

import { TILE_COL, TILE_ROW } from "./ram.js";

// The colour attribute every cell of the colour fill is painted in. ram.js proposes
// BOARD_MODE for 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_ATTR = 0x8057;

// How many cells the next copy/fill helper writes (reloaded before each field).
const CELL_COUNT = 0x8055;

// Source of the top cell's live value (a work-RAM slot) and of the fixed ROM label.
const VALUE_SOURCE = 0x8000;
const LABEL_SOURCE = 0x496d;

export function loc_4894(m) {
  const { mem } = m;

  // Target cell of the panel: column 6, row 10.
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 10);

  // Turn (row, col) into the tilemap offset for the cell. (0x48a1 is where this call
  // resumes; pushing it satisfies the still-oracle helper's stack return.)
  m.push16(0x48a1);
  m.call(0x3dae);

  // Derive the colour-RAM and video-RAM write cursors from that offset.
  m.push16(0x48a4);
  m.call(0x3dc9);

  // The colour the follow-on colour fill will paint the label run in.
  mem.write8(FILL_ATTR, 150);

  // Top field: copy one cell from the live work-RAM value down the video column.
  mem.write8(CELL_COUNT, 1);
  m.regs.ix = VALUE_SOURCE; // the source pointer the copy helper reads
  m.push16(0x48b5);
  m.call(0x3dea);

  // Label field: fill the next eight cells (cap glyph + seven ROM glyphs), continuing
  // down the same video column from where the value left off.
  mem.write8(CELL_COUNT, 8);
  m.regs.ix = LABEL_SOURCE; // the source pointer the fill helper reads
  m.push16(0x48c1);
  m.call(0x3ddb);

  // Hand off to the colour-column filler with the label field's count of eight still in
  // place, so it tints those eight cells; its return unwinds straight to our caller, so
  // this is loc_4894's exit (a tail hand-off, which pushes nothing — the filler's own
  // return address is our caller's).
  return m.call(0x3e01);
}
