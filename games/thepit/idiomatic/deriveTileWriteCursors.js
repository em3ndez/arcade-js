// SPDX-License-Identifier: GPL-3.0-only
/**
 * deriveTileWriteCursors — turn a tile's tilemap offset into its colour-map and video-map write cursors.
 *
 * The tile-plotter has already reduced a (row, column) cell to a single linear tilemap
 * offset in TILEMAP_OFFSET. Both maps share one layout, so the same offset addresses the
 * same cell in each — its colour byte at the colour-map base, its character byte at the
 * video-map base. Both absolute addresses are stored as write cursors (COLOUR_RAM_CURSOR
 * for colour, a sibling cell for video) that the follow-on column fill re-reads.
 */

import { COLOUR_RAM_CURSOR, TILEMAP_OFFSET } from "./names.js";

const COLOUR_RAM_BASE = 0x8800; // per-tile colour map base
const VIDEO_RAM_BASE = 0x9000; // tilemap (character) map base

export function deriveTileWriteCursors(m) {
  const { mem16 } = m;

  const offset = mem16[TILEMAP_OFFSET];

  // Same cell in both maps at the same offset: colour cursor, then video cursor.
  mem16[COLOUR_RAM_CURSOR] = COLOUR_RAM_BASE + offset;
  mem16[0x8060] = VIDEO_RAM_BASE + offset;
}
