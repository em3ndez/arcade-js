// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileInProbeRow — is the tile at an object's probe cell listed in this phase's
 * probe-table row?  ROM 0x33bc.
 *
 * The enemy/object mover, before it commits a step, checks the tile it is about to
 * move into against a small lookup table. That table is grouped into 32-tile rows,
 * one row per sub-cell phase of the object's position; a tile that appears in the
 * selected row is a "match" for this direction, and the mover uses that yes/no to
 * pick which movement handler to hand off to. This routine is that single check.
 *
 * It gathers three things the mover has already worked out this frame:
 *   - the phase-row selector (which 32-tile row of the table to look in);
 *   - the tilemap pointer at the object's probe cell (where the tile to test lives);
 *   - the object's sub-row position, which decides one alignment detail: at the one
 *     phase where the object straddles a cell boundary, the probe samples the cell
 *     one step back — the cell it is entering rather than the one it is leaving.
 * It then scans the 32-tile row for that tile and returns whether it was found.
 *
 * Reads only memory; writes none. Every caller (the mover at 0x319d) consumes just
 * the found/not-found result — "if found, hand off to the movement handler" — so
 * that boolean is the whole contract; the search's leftover pointer, count, and
 * matched byte are dead once the caller has branched on the result.
 *
 * Kept as a mechanism-descriptive name, not a directional one: the table search and
 * its yes/no result are certain from the code, but which travel direction each of
 * the four sibling probe tables (this one and 0x33da/0x3410/0x3425) stands for, and
 * whether a match means "passable" or "blocked", are not yet pinned — so the name
 * claims only what is proven: a tile-vs-row membership test.
 *
 * Memory-equivalent to the frozen oracle — equivalence-33bc.test.js.
 * GATE:     crafted-entry — 0x33bc is never dispatched in attract (the mover 0x319d
 *           runs thousands of times but never takes a probe arm in the demo), so a
 *           real attract state is captured at 0x319d and the probe's inputs are
 *           poked. EQUAL over an exhaustive per-row search-byte sweep (found and
 *           not-found across the whole byte domain) plus a boundary-offset matrix
 *           that ties the result to the one-step-back sampling, each compared to the
 *           oracle's found flag.
 * LIVE-OUT: the returned found flag (the oracle's Z result) — the only thing any
 *           caller reads. Writes no memory; leaves no live registers.
 * NAMES:    SUBTILE_PHASE (0x808d, phase-row selector) and PROBE_CELL_PTR (0x8089,
 *           probe-cell tilemap pointer) from ram.js; ENEMY_WORK_Y 0x8086 (object sub-row);
 *           0x34fe is the ROM probe table.
 */

import { PROBE_CELL_PTR, SUBTILE_PHASE, ENEMY_WORK_Y } from "./ram.js";
export function tileInProbeRow(m) {
  const { mem8, mem16 } = m;

  // Which 32-tile row of the probe table to search (chosen by the object's phase).
  const rowSelector = mem8[SUBTILE_PHASE];

  // The tile to test lives at the object's probe-cell tilemap pointer.
  let probeCell = mem16[PROBE_CELL_PTR];

  // At the phase where the object straddles a cell boundary, sample one cell back —
  // the cell being entered, not the one being left.
  const subRow = mem8[ENEMY_WORK_Y];
  if ((subRow + 5) % 8 === 0) probeCell = probeCell - 1;
  const tile = mem8[probeCell];

  // Scan this phase's 32-tile row for that tile.
  const rowBase = 0x34fe + rowSelector; // ROM probe table, 32 bytes per phase row
  for (let i = 0; i < 32; i++) {
    if (mem8[rowBase + i] === tile) return true; // tile is in the row
  }
  return false; // tile is not in the row
}
