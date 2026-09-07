// SPDX-License-Identifier: GPL-3.0-only
//
// redrawTileColumnsPeriodically -- ROM 0x0367, grounding [seen].
//
// WHAT IT IS
//   A periodic VRAM refresh for a run of decorative tile-columns (the cycling background columns the
//   attract/sequence machine lays down). It does nothing most frames; on two specific frame phases it
//   either wipes the columns or repaints them, so the run keeps animating without redrawing every frame.
//
// ROLE IN THE MACHINE
//   Called as one of the shared per-frame subsystem updates by several sequence-state handlers (e.g.
//   dwellThenAdvanceSequence 0x028e). It is gated by two cells: DRAWN_COLUMN_COUNT (0x4241), the running
//   count of columns queued to redraw, and FRAME_COUNTER (0x425f), the free-running counter the VBLANK-NMI
//   decrements once per frame. The low six bits of FRAME_COUNTER select the phase; the top two bits pick
//   which source row seeds the first column, so successive cycles show different content.
//
// LIVE-OUT: VRAM cells of the drawn columns (via drawTileColumnTriple / blankTileColumns). No cell writes
//   of its own; the source/dest chaining lives inside the two block helpers.
import { blankTileColumns } from "./blankTileColumns.js";
import { drawTileColumnTriple } from "./drawTileColumnTriple.js";
import { DRAWN_COLUMN_COUNT, FRAME_COUNTER, loc_5193, TILE_COLUMN_TABLE, TILE_COLUMN_TABLE_CONT } from "./names.js";

const ROW_BYTES = 3;    // one source row = three cells stamped up a column
const DRAW_PHASE = 32;  // frame-counter low-6 value that triggers a draw

export function redrawTileColumnsPeriodically(m) {
  const { mem8 } = m;

  // Gate: at least two columns must be queued. With fewer than two counted there is nothing to cycle,
  // so leave. `columns` is count-1 because the count includes a header/sentinel slot -- the actual run
  // of drawable columns is one shy of the stored count.
  const count = mem8[DRAWN_COLUMN_COUNT];
  if (count < 2) return;
  const columns = count - 1;

  // Read the per-frame counter and isolate the low six bits as the phase. Only two of the 64 phases do
  // any work, which is what makes this a cheap periodic refresh rather than a per-frame redraw.
  const frame = mem8[FRAME_COUNTER];
  const phase = frame & 0x3f;

  // Phase 0: the blank pass. Erase the whole run of columns (stamps blank tile 16 into three cells per
  // column, stepping -32 per row and +98 per column) and return -- nothing is painted this frame.
  if (phase === 0) {
    blankTileColumns(m, columns);
    return;
  }

  // Every phase except the draw phase is idle. Only phase 32 (half a cycle after the blank) repaints.
  if (phase !== DRAW_PHASE) return;

  // First column: pick its source row by the frame counter's top two bits (row 0..3 of TILE_COLUMN_TABLE,
  // 3 bytes each), and draw the triple into the VRAM start cell loc_5193. drawTileColumnTriple copies the
  // three source bytes up one column and returns the advanced src/dest so the next column chains from here.
  const row = (frame >> 6) & 0x03;
  drawTileColumnTriple(m, TILE_COLUMN_TABLE + row * ROW_BYTES, loc_5193);

  // Remaining columns stream consecutively from the continuation table. The first extra draw is seeded
  // with TILE_COLUMN_TABLE_CONT; each further call passes no args, so it reuses the src/dest the previous
  // call advanced -- threading the source stream and VRAM cursor forward across the run.
  let remaining = columns - 1;
  if (remaining === 0) return;
  drawTileColumnTriple(m, TILE_COLUMN_TABLE_CONT);
  while (--remaining !== 0) drawTileColumnTriple(m);
}
