// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextTileInProbeRow — one of four sibling table searches the object-movement dispatcher uses
 * to decide whether a move in a given direction is allowed, returning the found/not-found
 * boolean the dispatcher branches on to pick a velocity-preset handler. SUBTILE_PHASE chooses
 * the 32-byte row (its value is bytes past the table base); the key is the byte just past the
 * display-cell pointer in PROBE_CELL_PTR — the neighbouring tile code, the "+1" load-bearing.
 * A row exhausted with no match answers "not allowed". Tile-code/allowed-set reading is
 * inferred, so the name stays neutral.
 */

import { PROBE_CELL_PTR, PROBE_NEXT_TILE_TABLE, SUBTILE_PHASE } from "./names.js";


export function nextTileInProbeRow(m) {
  const { mem8, mem16 } = m;

  // Which 32-byte row to scan, and where in the table it starts.
  const rowIndex = mem8[SUBTILE_PHASE];
  const rowBase = PROBE_NEXT_TILE_TABLE + rowIndex;

  // The key: the tile code one cell past the object's current display cell.
  const cellPtr = mem16[PROBE_CELL_PTR];
  const key = mem8[cellPtr + 1];

  // Walk up to 32 bytes, stopping at the first match.
  for (let i = 0; i < 32; i++) {
    if (mem8[rowBase + i] === key) return true;
  }
  return false;
}
