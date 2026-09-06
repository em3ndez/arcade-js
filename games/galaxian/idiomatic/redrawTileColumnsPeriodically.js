// SPDX-License-Identifier: GPL-3.0-only
// Periodically redraw a run of VRAM tile-columns, gated by a running column count and the frame phase.
// Fewer than two counted columns: nothing. On the blank phase wipe the columns; on the draw phase draw
// them -- the first from a frame-selected source row, the rest from the consecutive source stream.
import { blankTileColumns } from "./blankTileColumns.js";
import { drawTileColumnTriple } from "./drawTileColumnTriple.js";
import { DRAWN_COLUMN_COUNT, loc_425f, loc_5193, TILE_COLUMN_TABLE, TILE_COLUMN_TABLE_CONT } from "./names.js";

const ROW_BYTES = 3;    // one source row = three cells stamped up a column
const DRAW_PHASE = 32;  // frame-counter low-6 value that triggers a draw

export function redrawTileColumnsPeriodically(m) {
  const { mem8 } = m;

  const count = mem8[DRAWN_COLUMN_COUNT];
  if (count < 2) return;
  const columns = count - 1;

  const frame = mem8[loc_425f];
  const phase = frame & 0x3f;
  if (phase === 0) {
    blankTileColumns(m, columns);
    return;
  }
  if (phase !== DRAW_PHASE) return;

  // First column from the row picked by the frame counter's top two bits, into the VRAM start.
  const row = (frame >> 6) & 0x03;
  drawTileColumnTriple(m, TILE_COLUMN_TABLE + row * ROW_BYTES, loc_5193);

  // Remaining columns from the consecutive source, threading src and dest forward from each draw.
  let remaining = columns - 1;
  if (remaining === 0) return;
  drawTileColumnTriple(m, TILE_COLUMN_TABLE_CONT);
  while (--remaining !== 0) drawTileColumnTriple(m);
}
