// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  COLUMN_BLIT_TILE_SRC,
  COLUMN_BLIT_ATTR_SRC,
  COLUMN_BLIT_TILE_DEST,
  COLUMN_BLIT_ATTR_DEST,
} from "./names.js";
/**
 * loc_0cf8 — stamp a two-plane column strip into video RAM.  [seen]
 *
 * ROM 0x0cf8. A one-shot screen painter: it copies a fixed block of column data out of the ROM
 * bytes that sit just past this routine and lays it into the character display, one vertical
 * strip of cells at a time, across BOTH of the display's two planes.
 *
 * The hardware character display is a grid of cells, 0x20 (32) cells to a row, so cells one
 * directly above another are 0x20 apart in memory. Each cell is described by two parallel
 * planes at different base addresses: a TILE-CODE plane (which glyph to draw) and an ATTRIBUTE
 * plane (its colour). This routine fills a rectangle in the tile plane, then the matching
 * rectangle in the attribute plane, so the painted region comes up both shaped and coloured.
 *
 * The source is a packed table of columns. Each column is exactly 0x0c (12) bytes, laid out
 * top-of-strip first, and the columns run back-to-back with no separator. After every column a
 * STEERING byte is peeked (never consumed as data):
 *   - 0xff  — the tile-plane block is done; jump the source to the attribute table
 *             (COLUMN_BLIT_ATTR_SRC = 0x0d48) and the destination to the attribute plane, and
 *             keep painting there.
 *   - 0xee  — the whole stamp is finished; stop.
 *   - anything else — it is not a marker at all but the first byte of the next column, so paint
 *             one more strip immediately to the right.
 * The tile pass starts from COLUMN_BLIT_TILE_SRC (0x0d2f) into COLUMN_BLIT_TILE_DEST (0x86a7);
 * the 0xff switch restarts from COLUMN_BLIT_ATTR_SRC (0x0d48) into COLUMN_BLIT_ATTR_DEST
 * (0x82a7).
 *
 * LIVE-OUT: none — the written video-RAM cells are the whole effect; no register is read back.
 */
export function loc_0cf8(m) {
  const { mem8 } = m;

  // Begin on the tile-code plane: read column data from the tile source table (0x0d2f) and
  // aim at the tile-plane destination cell (0x86a7). `colTop` tracks the first cell of the
  // strip about to be painted; the 0xff steering byte later re-points both of these at the
  // attribute plane.
  let src = COLUMN_BLIT_TILE_SRC;
  let colTop = COLUMN_BLIT_TILE_DEST;
  for (;;) {
    // Paint one vertical strip: 0x0c cells, starting at the strip's anchor cell and stepping
    // UP the screen one row (0x20 cells) per byte. Because cells stacked vertically are 0x20
    // apart, subtracting 0x20 from the destination each step walks straight up the column.
    let dest = colTop;
    for (let n = 0x0c; n > 0; n--) {
      mem8[dest] = mem8[src];
      src = u16(src + 1);
      dest = u16(dest - 0x20); // up one video-RAM row
    }

    // Peek the byte that follows the 0x0c-byte column. It steers the copy but is NOT advanced
    // past unless it is a genuine 0xff/0xee marker — a data byte here is left for the next
    // column to consume.
    const marker = mem8[src];
    if (marker === 0xff) {        // tile plane done — switch to the attribute plane
      // Restart from the attribute column table (0x0d48) into the attribute-plane destination
      // (0x82a7); painting continues identically, now laying colour instead of glyphs.
      src = COLUMN_BLIT_ATTR_SRC;
      colTop = COLUMN_BLIT_ATTR_DEST;
      continue;
    }
    if (marker === 0xee) return;  // end-of-stamp marker — the whole two-plane stamp is done

    // Not a marker: the peeked byte is the first cell of the next column. Advance the strip
    // anchor one cell to the right and paint again (the source pointer is left where it is, so
    // that byte becomes the top of the new column).
    colTop = u16(colTop + 1);     // next column, one cell right
  }
}
