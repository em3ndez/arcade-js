// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blankTileColumn — erase a three-cell vertical run of the tilemap back to the blank tile.
 *
 * ROM 0x02b1-0x02b8. Grounding: [seen].
 *
 * WHAT IT IS: a tiny tilemap eraser. The playfield is a grid of 8x8 character cells laid
 * out row by row in video RAM; successive rows sit one row-pitch apart. Given a pointer to
 * the top cell of a column and that row pitch, this stamps the blank/erase character 0x10
 * into three cells straight down — the top cell, the cell one pitch below, and the cell two
 * pitches below — wiping a short vertical strip of the display.
 *
 * ROLE IN THE MACHINE: the erase half of a scrolling/redraw pass. As artwork moves, the
 * cells it just vacated must be cleared before the new content is drawn, or a smear of stale
 * characters is left behind. This routine clears exactly three cells; a caller that needs a
 * taller column chains it, feeding the advanced pointer straight back in to blank the next
 * three-cell run.
 *
 * STRIDE: the row pitch is a signed 16-bit addend. It is only ever added, never written, so
 * a caller's stride survives the call unchanged.
 *
 * A PURE LEAF: it calls nothing, and writes only the three tile cells.
 *
 * LIVE-OUT: the pointer advanced to the last cell written (start + 2*stride, taken 16-bit),
 * returned and chained into the next column, so wiring must write it back.
 */

const TILE_BLANK = 0x10; // the blank/erase character stamped into every cleared cell

export function blankTileColumn(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;

  // Walk three cells straight down the column, one row-pitch apart, stamping the blank
  // character into each. `stride` is the tilemap's row-to-row byte pitch, so each add steps
  // the pointer down one on-screen row. The pointer is left on the third (bottom) cell.
  let cell = start;
  mem8[cell] = TILE_BLANK; // top cell of the run
  cell = cell + stride;
  mem8[cell] = TILE_BLANK; // one row down
  cell = cell + stride;
  mem8[cell] = TILE_BLANK; // two rows down

  // Hand back the pointer resting on the bottom cell. A caller blanking a taller column
  // feeds this straight back in as the top of the next three-cell run.
  return (m.regs.hl = u16(cell)); // HL live-out: the advanced pointer, chained into the next column
}
