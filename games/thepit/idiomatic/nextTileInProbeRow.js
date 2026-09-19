// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextTileInProbeRow — one of four sibling table searches the object-movement dispatcher uses
 * to decide whether a move in a given direction is allowed. It scans a 32-byte row of a
 * per-direction table for a single key byte and reports whether the key was present; the
 * dispatcher tests that answer to pick which velocity-preset handler to run — a "can the
 * object step this way?" gate. SUBTILE_PHASE chooses the row (its value is how many bytes past
 * the table base the row starts); the key is the byte just past the display-cell pointer in
 * PROBE_CELL_PTR — the neighbouring tile code, the "+1" load-bearing. The scan stops at the
 * first match; a row exhausted with no match answers "not allowed". The bytes read as tile
 * codes and the tables as per-direction allowed-tile sets, but that is inferred, so the name
 * stays neutral.
 */

import { F_Z } from "../../../core/cpu/z80.js";
import { PROBE_CELL_PTR, PROBE_NEXT_TILE_TABLE, SUBTILE_PHASE } from "./names.js";


export function nextTileInProbeRow(m) {
  const { regs, mem8, mem16 } = m;

  // Which 32-byte row to scan, and where in the table it starts.
  const rowIndex = mem8[SUBTILE_PHASE];
  const rowBase = PROBE_NEXT_TILE_TABLE + rowIndex;

  // The key: the tile code one cell past the object's current display cell.
  const cellPtr = mem16[PROBE_CELL_PTR];
  const key = mem8[cellPtr + 1];

  // Walk up to 32 bytes, stopping at the first match. The cursor lands one byte past
  // the matched cell on a hit, or at the row's end when nothing matched.
  let cursor = rowBase;
  let matched = false;
  for (let i = 0; i < 32; i++) {
    const hit = mem8[cursor] === key;
    cursor += 1;
    if (hit) {
      matched = true;
      break;
    }
  }

  // Publish what the caller reads: the found/not-found answer it branches on,
  // plus the cursor position where the scan left it.
  regs.hl = cursor;
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
}
