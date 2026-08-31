// SPDX-License-Identifier: GPL-3.0-only
import { paintColumnBodyTilesUp } from "./paintColumnBodyTilesUp.js";
import { COLUMN_CAP_VRAM } from "./names.js";
/**
 * stampCappedTileColumnUp — draw one three-cell "capped" vertical column into the tilemap: a
 * distinct cap tile at the anchor cell, then the two body tiles stepping one screen row up for
 * each.
 *
 * WHAT IT IS
 *   ROM 0x1ce7. Grounding: [seen].
 *   Pooyan's background picture is a tilemap. Video RAM (0x8400-0x87FF) holds one tile-code byte
 *   per cell across a 32x32 grid, and a parallel colour-attribute plane supplies each cell's
 *   palette and flip bits. This routine stamps a single vertical column graphic made of three
 *   stacked tiles — a cap on top of a two-tile body — by writing three tile-code bytes straight
 *   into that plane.
 *
 * ITS ROLE IN THE MACHINE
 *   One of the fixed column graphics the tilemap column painters lay down. Where the machine
 *   needs a capped scroll column drawn (the two-player-mode variant of the repainted scroll
 *   columns), this is the stamp it uses. Because the column painters step one screen row upward
 *   per cell on every repaint pass, redrawing these columns at a shifted anchor is what animates
 *   the scrolling background.
 *
 * THE TILEMAP GEOMETRY
 *   On this video hardware one on-screen row is a fixed 0x20 (32) bytes apart in memory, and rows
 *   GROW DOWNWARD in address — so a cell one row UP on screen sits 0x20 bytes LOWER in memory.
 *   The cap is written at COLUMN_CAP_VRAM (0x84e0, the column's cap cell in the tile-code plane);
 *   the body helper then climbs upward from there using that negative 0x20 row stride.
 *
 * LIVE-OUT: memory only — the three tile-code cells (the cap plus the two body tiles one and two
 *   rows above it). The pointer the column walk advances is not read back afterward, so nothing
 *   else survives.
 */

const TILE_CAP = 0x02; // the column's top cap tile

export function stampCappedTileColumnUp(m) {
  const { mem8 } = m;
  // Drop the cap tile at the column's anchor cell. COLUMN_CAP_VRAM (0x84e0) is the cap cell in
  // the tile-code plane, and 0x02 is the distinct cap graphic that tops the column.
  mem8[COLUMN_CAP_VRAM] = TILE_CAP;
  // Fill in the rest of the column starting from that same cell: paintColumnBodyTilesUp lays the
  // mid body tile one row up and the base body tile a second row up — each step subtracts the
  // 0x20 row stride — completing the three-cell capped column.
  return paintColumnBodyTilesUp(m, COLUMN_CAP_VRAM);
}
