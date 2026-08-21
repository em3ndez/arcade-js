// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColumnBodyTilesUp — stamp a column's two body tiles, stepping one row up each time.
 *
 * From the caller's tilemap cell, moves up one row (fixed stride -0x20) and writes the mid
 * tile 0x25, then up another row and writes the base tile 0x20 — the fixed-up-stride variant
 * of the column-body paint. Two cells written, nothing read; a leaf that calls nothing.
 *
 * LIVE-OUT: memory only (the two tiles). HL advances to start-0x40, but no caller reads it.
 */

const ROW_UP = -0x20; // one tilemap row up, as a signed addend
const TILE_MID = 0x25;
const TILE_BASE = 0x20;

export function paintColumnBodyTilesUp(m, start = m.regs.hl) {
  const { mem8 } = m;
  const mid = start + ROW_UP;
  mem8[mid] = TILE_MID;
  const base = mid + ROW_UP;
  mem8[base] = TILE_BASE;
}
