// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeRowAheadTilePair — a two-stage tile-table probe: does the tile one row on from the
 * object's current cell (and, conditionally, the one beside it) belong to the table rows keyed
 * by the object's sub-tile phase?
 *
 * One of four sibling probes the per-object move/collision driver chains: it tries each in turn
 * and, on the first that reports a match, hands the object to a movement handler. This probe
 * advances the object's tilemap pointer PROBE_CELL_PTR by 32 (one row down in the 32-column
 * tilemap), stashes it at SAVED_CELL_PTR, then looks up whether the tile now under it appears in
 * the first table's 32-entry row (chosen by the object's sub-tile phase); if not, the probe fails.
 * When it matches AND the phase is nonzero it tightens the test: the following tile must also
 * appear in the second table's row (phase shifted the other way), and that second lookup is the
 * result. A zero phase reports the first match. The phase indexes both rows with a byte-wide wrap;
 * the name stays neutral, and "ahead" is the +32 memory-row offset, not a screen direction.
 */

import { F_Z } from "../../../core/cpu/z80.js";
import { PROBE_CELL_PTR, SAVED_CELL_PTR, SUBTILE_PHASE } from "./names.js";


const FIRST_TABLE = 0x34fe; // base of the first valid-tile table (rows of 32)
const SECOND_TABLE = 0x35fe;
const ROW_LEN = 32; // entries per table row / the pointer's one-row stride

function rowContains(mem8, base, key) {
  for (let i = 0; i < ROW_LEN; i++) {
    if (mem8[base + i] === key) return true;
  }
  return false;
}

export function probeRowAheadTilePair(m) {
  const { mem8, mem16, regs } = m;

  const phase = mem8[SUBTILE_PHASE];
  // Advance the tilemap pointer one row and stash it at SAVED_CELL_PTR for the reload below.
  const cell = (mem16[PROBE_CELL_PTR] + ROW_LEN) & 0xffff;
  mem16[SAVED_CELL_PTR] = cell;

  // First row (selected by the phase, byte-wrapped): must hold the tile under the pointer.
  let matched = rowContains(mem8, FIRST_TABLE + (phase + ROW_LEN) % 256, mem8[cell]);

  // Nonzero phase also requires the following tile in the second row; zero reports as-is.
  if (matched && phase !== 0) {
    matched = rowContains(
      mem8,
      SECOND_TABLE + (phase - ROW_LEN + 256) % 256,
      mem8[(cell + 1) & 0xffff],
    );
  }

  // Report the match through the flag the caller tests, and as the boolean return.
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
  return matched;
}
