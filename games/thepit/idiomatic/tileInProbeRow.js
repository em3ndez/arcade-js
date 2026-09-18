// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileInProbeRow — is the tile at the object's probe cell in this phase's probe row?
 *
 * Before the mover commits a step it tests the tile ahead against a table of 32-tile
 * rows, one per sub-cell phase; a tile in the selected row is a "match" for this
 * direction and the mover branches on that yes/no. At the phase where the object
 * straddles a cell boundary the probe samples one cell back — the cell being entered.
 * Reads only memory; the boolean is the whole contract. Which direction a match means,
 * and whether it is passable or blocked, stay unpinned — the name is mechanism-level.
 */

import { PROBE_CELL_PTR, SUBTILE_PHASE, ENEMY_WORK_Y } from "./names.js";
export function tileInProbeRow(m) {
  const { mem8, mem16 } = m;

  // Which 32-tile row of the probe table to search (chosen by the object's phase).
  const rowSelector = mem8[SUBTILE_PHASE];

  // The tile to test lives at the object's probe-cell tilemap pointer.
  let probeCell = mem16[PROBE_CELL_PTR];

  // At the boundary phase, sample one cell back — the cell being entered, not left.
  const subRow = mem8[ENEMY_WORK_Y];
  if ((subRow + 5) % 8 === 0) probeCell = probeCell - 1;
  const tile = mem8[probeCell];

  // Scan this phase's 32-tile row for that tile.
  const rowBase = 0x34fe + rowSelector; // probe table, 32 bytes per phase row
  for (let i = 0; i < 32; i++) {
    if (mem8[rowBase + i] === tile) return true;
  }
  return false;
}
