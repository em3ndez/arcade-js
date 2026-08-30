// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * paintColumnBodyTiles — stamp the two body tiles of a vertical tilemap column. [seen]
 *
 * ROM 0x02aa-0x02b0.
 *
 * WHAT IT IS
 *   A tiny tilemap-drawing primitive. Given a cursor into the tile RAM and a per-row stride,
 *   it steps down two rows and writes a fixed tile at each — the lower two cells of a
 *   three-cell vertical column.
 *
 * ROLE IN THE MACHINE
 *   The playfield is a column-oriented tilemap: because of how the video hardware is laid
 *   out, walking one cell "down" the screen means advancing the address by a fixed stride
 *   (supplied by the caller in the pair register). A three-tile column is drawn as a cap on
 *   top plus these two body tiles below. The caller writes the cap at the starting cursor
 *   first; this routine, entered with that same cursor, fills in the two cells beneath it.
 *
 * MECHANISM
 *   Step the cursor by one stride and write TILE_MID (0x25), the column's middle body tile;
 *   step again and write TILE_BASE (0x20), the base tile. The starting cell is not touched
 *   here (the caller already stamped the cap there). Nothing is read back; this is a pure
 *   leaf that calls nothing.
 *
 * LIVE-OUT: memory (the two body tiles); returns the advanced pointer (start + 2*stride,
 * kept 16-bit) so a caller can keep drawing from where the column ended.
 */

const TILE_MID = 0x25; //  the column's middle body tile
const TILE_BASE = 0x20; // the column's base tile

export function paintColumnBodyTiles(m, start = m.regs.hl, stride = m.regs.de) {
  const { mem8 } = m;

  // Step down one row (add the stride) and lay the middle body tile.
  const mid = start + stride;
  mem8[mid] = TILE_MID;

  // Step down another row and lay the base tile — the bottom of the three-cell column.
  const base = mid + stride;
  mem8[base] = TILE_BASE;

  // Hand back the cursor advanced past both cells (kept 16-bit) for continued drawing.
  return u16(base);
}
