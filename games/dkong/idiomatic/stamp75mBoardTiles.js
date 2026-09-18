// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp75mBoardTiles — during elevator-board setup, stamp two fixed two-row tile motifs into the
 * background tilemap: 17+17 cells at two hard-coded positions, the second eight rows above the
 * first, 68 background cells total. No input; no board check (reached only from the elevator arm).
 *
 * LIVE-OUT: memory-only.
 */

import { fillTileRowPair } from "./fillTileRowPair.js";

export function stamp75mBoardTiles(m) {
  fillTileRowPair(m, 0x770d);
  fillTileRowPair(m, 0x760d);
}
