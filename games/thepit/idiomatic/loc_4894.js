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
 * the label continues directly below the live value — and finally tail-calls the
 * colour-column filler, which tints the run in one colour; its result is loc_4894's.
 *
 * Unlike the sibling panel painters, this one does NOT reset the cell count before
 * the colour fill: it leaves the label field's count of eight in place, so the colour
 * run covers eight cells rather than the full nine — the top live-value cell keeps
 * whatever colour it already had.
 *
 * THREE OF THE LAYOUT HELPERS ARE NOW DECOMPILED and called directly as ordinary JS:
 * rowColToTileOffset (the offset step), deriveTileWriteCursors (the cursor step), and
 * fillColourColumn (the colour tail). They read and write their scratch cells through
 * `m`, so the direct call is a drop-in for the old register/stack-marshalled boundary
 * — no return address to push, no register to marshal.
 *
 * The two COPY/FILL helpers (0x3dea, 0x3ddb) are STILL the frozen oracle, reached
 * through the registry. Each reads its source pointer from IX and returns through the
 * machine's stack, so each of those two calls keeps its IX load and the return-address
 * push it expects to find on the stack — a genuine oracle boundary. This game keeps the
 * Z80 stack (which lives at the top of work RAM) byte-identical to the hardware, so
 * those two pushes still land the stack exactly as the oracle leaves it. (When those two
 * helpers are later decompiled, their pushes dissolve into ordinary calls too.)
 *
 * Name kept as loc_4894: it is clearly a fixed-panel painter, but which specific field
 * it draws is not pinned (the label glyphs are ROM tile codes, not decoded), and it is
 * one of a family of near-identical panel painters — below the bar for an English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4894.test.js.
 * GATE:     observable equivalence — captured at the real attract dispatch (0x4894 runs
 *           once during a boot/attract run, reached from loc_03e8 when its housekeeping
 *           counter hits zero), oracle vs idiomatic diffed on clones of that entry, plus
 *           a sweep of the one state-dependent input (the live top-cell value at 0x8000).
 *           The three dissolved calls no longer push their Z80 return addresses, so the
 *           dead stack-scratch window just below the entry SP, the exit pc, and SP now
 *           legitimately differ from the oracle; the gate aligns pc + SP by modelling the
 *           tail return with one m.ret() on the candidate and excludes that dead stack
 *           window, then compares the observable RAM byte-for-byte. Teeth twins caught.
 * LIVE-OUT: memory-only — the panel's tilemap + colour cells and the layout scratch
 *           (0x805a offset, 0x805e/0x8060 cursors). The routine tail-calls the colour
 *           filler, whose return goes to our caller.
 * NAMES:    TILE_COL, TILE_ROW from ram.js. 0x8057 kept local (FILL_ATTR) — ram.js
 *           proposes BOARD_MODE for that address, but here it is unambiguously the
 *           panel's colour byte, so a local role name is used instead of a misfit
 *           import. 0x8055 (CELL_COUNT, per-field cell count) and the source pointers
 *           0x8000 / 0x496d are not named in ram.js.
 */

import { TILE_COL, TILE_ROW } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

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

  // Turn (row, col) into the tilemap offset for the cell.
  rowColToTileOffset(m);

  // Derive the colour-RAM and video-RAM write cursors from that offset.
  deriveTileWriteCursors(m);

  // The colour the follow-on colour fill will paint the label run in.
  mem.write8(FILL_ATTR, 150);

  // Top field: copy one cell from the live work-RAM value down the video column. The
  // copy helper is still the oracle — it reads its source from IX and returns through
  // the stack, so its IX load and return-address push stay.
  mem.write8(CELL_COUNT, 1);
  m.regs.ix = VALUE_SOURCE; // the source pointer the copy helper reads
  m.push16(0x48b5);
  m.call(0x3dea);

  // Label field: fill the next eight cells (cap glyph + seven ROM glyphs), continuing
  // down the same video column from where the value left off. The fill helper is still
  // the oracle — same IX-source + stack-return convention.
  mem.write8(CELL_COUNT, 8);
  m.regs.ix = LABEL_SOURCE; // the source pointer the fill helper reads
  m.push16(0x48c1);
  m.call(0x3ddb);

  // Hand off to the colour-column filler with the label field's count of eight still in
  // place, so it tints those eight cells. A tail call: its result is loc_4894's result.
  return fillColourColumn(m);
}
