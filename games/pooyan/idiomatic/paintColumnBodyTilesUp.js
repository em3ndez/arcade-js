// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColumnBodyTilesUp — stamp a column's two body tiles, stepping one tilemap row up
 * each time.
 *
 * ROM 0x1cec. Grounding: [seen].
 *
 * A leaf helper in the background-column painter. The caller has already settled on a cell in
 * the tilemap and hands its address in as `start`; from there this routine walks UP the screen
 * two rows and drops one tile at each stop. On Pooyan's video hardware the tilemap is laid out
 * so that one on-screen row is a fixed distance of 0x20 (32) bytes in memory, and rows GROW
 * DOWNWARD in address — so moving up a row means SUBTRACTING 0x20, the negative stride used
 * throughout the column painters (see also paintPhaseGauge, which shares the -0x20 step).
 *
 * The two tiles form the body of a vertical column graphic: 0x25 is written one row up (the
 * "mid" body tile) and 0x20 another row above that (the "base" body tile). It is the fixed-up
 * variant of the column-body paint — the destination only ever climbs, never descends.
 *
 * LIVE-OUT: memory only — the two tilemap cells at start-0x20 and start-0x40. The ROM leaves
 * its running pointer at start-0x40, but no caller reads that back, so nothing else survives.
 */

const ROW_UP = -0x20; // one tilemap row up: rows are 0x20 bytes apart and grow downward
const TILE_MID = 0x25; // column-body mid tile, written to the nearer cell
const TILE_BASE = 0x20; // column-body base tile, written to the farther (higher) cell

export function paintColumnBodyTilesUp(m, start = m.regs.hl) {
  const { mem8 } = m;

  // Step up one row from the caller's cell and lay down the mid body tile. Subtracting the
  // 0x20 row stride moves the destination one line higher on screen.
  const mid = start + ROW_UP;
  mem8[mid] = TILE_MID;

  // Step up a second row and lay down the base body tile, completing the two-cell column body.
  const base = mid + ROW_UP;
  mem8[base] = TILE_BASE;
}
