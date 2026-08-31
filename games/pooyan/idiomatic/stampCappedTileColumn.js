// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { paintColumnBodyTiles } from "./paintColumnBodyTiles.js";
/**
 * stampCappedTileColumn — stamp one complete three-tile vertical column into the playfield
 * tilemap: a distinctive cap tile at the top cell, then the two body tiles beneath it.
 *
 * WHAT IT IS
 *   A tiny tilemap-drawing primitive living at ROM 0x02a8. Given a cursor into tile RAM and
 *   a per-row stride, it lays a full three-cell vertical column. It is the "capped" member of
 *   a little family of column leaves that share this corner of the drawing code: one blanks a
 *   column, one paints only the two body tiles, and this one caps a column and then paints its
 *   body. The cap byte is written here; the two body tiles are delegated to the body helper.
 *
 * ROLE IN THE MACHINE
 *   The playfield is a column-oriented tilemap. Because of how the video hardware maps memory
 *   addresses to screen cells, stepping one cell along a vertical column means advancing the
 *   tile-RAM address by a fixed stride, which the caller supplies. Pooyan keeps the arena's
 *   side "scroll" columns repainted every frame so they read as continuously moving scenery.
 *   The per-frame scroll worker (repaintScrollColumnsElseVerifySignature) uses this routine to
 *   lay down the shared scroll column based at WORKER_COLUMN_VRAM (0x8740), handing it a stride
 *   of one tilemap row up (-0x20): the cap lands at 0x8740 and the mid and base tiles climb to
 *   0x8720 and 0x8700, so the three-cell column stands up the screen.
 *
 * GROUNDING: [seen].
 *
 * MECHANISM (two steps)
 *   1. Write the cap tile (TILE_CAP = 0x01) at the start cell — the anchor / top of the column.
 *   2. Delegate the rest to paintColumnBodyTiles with the same cursor and stride: it steps one
 *      stride to write the middle body tile (0x25) and another stride to write the base tile
 *      (0x20), completing the three-cell column, and reports the cursor advanced past the last
 *      cell written.
 *
 * LIVE-OUT: memory only — the three tilemap cells (cap plus the two body tiles). The returned
 * advanced pointer (start + two strides, wrapped to a 16-bit address) is a convenience for
 * chained drawing; the scroll worker discards it and reloads its own column base for the next
 * step, so the return value is not load-bearing.
 */

const TILE_CAP = 0x01;

export function stampCappedTileColumn(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;
  // Step 1 — stamp the cap tile at the start cell: the top of the three-cell column.
  mem8[start] = TILE_CAP;
  // Step 2 — fill the two body cells one and two strides away via the body helper, and hand
  // back its cursor (advanced past both cells, wrapped to 16 bits) for any continued drawing.
  return u16(paintColumnBodyTiles(m, start, stride));
}
