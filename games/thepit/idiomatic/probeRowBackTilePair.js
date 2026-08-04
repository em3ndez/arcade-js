// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeRowBackTilePair — probe two phase-keyed ROM tables for the tile one row back from the probe cell.  ROM 0x33da.
 *
 * One arm of the per-direction tile probe the movement dispatcher (stepEnemyMover) runs to decide
 * whether the object may travel a given way. It looks one tilemap row (the map is 32 cells
 * wide) back from the object's probe cell and asks whether that neighbouring tile — and, on a
 * hit, the tile just after it — appear in two 32-entry ROM tables whose row is chosen by the
 * object's current sub-tile phase. The dispatcher branches on the answer, steering a match
 * into one of the velocity presets.
 *
 *   - It always stashes the one-row-back cell at SAVED_CELL_PTR (a later step reloads it).
 *   - First it searches table A's phase row for the neighbouring tile. A miss ends the probe
 *     reporting "no match".
 *   - A hit while the sub-tile phase is 0 reports "match" immediately — there is no table-B
 *     row to consult at phase 0.
 *   - Otherwise it searches table B's phase row for the following tile and reports whether
 *     THAT tile matched.
 *
 * The sub-tile phase (SUBTILE_PHASE, 0x808d) selects the table row and is deliberately kept to a single byte,
 * so the selector wraps within 0..255 (phase 224 + 32 lands back at row 0 — a real case here,
 * where the phase only ever takes multiples of 32).
 *
 * Reads the sub-tile phase (SUBTILE_PHASE) and the probe-cell pointer (PROBE_CELL_PTR), plus the two
 * neighbouring tiles and the two ROM tables; writes only SAVED_CELL_PTR. Returns whether a match was
 * found and leaves the same answer in the zero flag for the still-oracle caller to branch on.
 *
 * Kept as probeRowBackTilePair: a sibling single-table probe (0x33bc) earns the descriptive name, but this
 * two-table variant's table semantics (what a match MEANS, and the tilemap's on-screen axis)
 * are not grounded enough to name without over-claiming — as its twins 0x3410/0x3425 also stay.
 *
 * Memory-equivalent to the frozen oracle — equivalence-33da.test.js.
 * GATE:     crafted-entry + real dispatches — every attract dispatch (the first-table-miss,
 *           phase-0 short-circuit, and second-table-search paths) on the full
 *           RAM+pc+SP+zero-flag contract, plus a crafted phase-0 hit and exhaustive
 *           key1/key2/phase sweeps. Teeth: a table-B-skipping twin and a wrong-stash twin.
 *           Reached from the tile-probe dispatcher during the attract demo (first dispatch ~frame 1600).
 * LIVE-OUT: the zero flag (match found) + the 0x8134 write. The leftover value registers (the
 *           search pointers and keys) are dead — the caller reads only the zero flag.
 * NAMES:    PROBE_CELL_PTR (0x8089, probe-cell tilemap pointer), SUBTILE_PHASE (0x808d, object
 *           sub-tile phase) and SAVED_CELL_PTR (0x8134, saved one-row-back cell) from names.js;
 *           F_Z is the CPU's zero-flag bit.
 *
 * PURPOSE [guess]: "Back"=the −32 MEMORY-row offset, NOT a screen direction; ROM tables' meaning unpinned.
 */
import { F_Z } from "../../../core/cpu/z80.js";
import { SUBTILE_PHASE, PROBE_CELL_PTR, SAVED_CELL_PTR } from "./names.js";

const TABLE_A = 0x34fe;       // base of the first phase-keyed ROM probe table's rows
const TABLE_B = 0x35fe;       // base of the second phase-keyed ROM probe table's rows

export function probeRowBackTilePair(m) {
  const { regs, mem8, mem16 } = m;

  // Look one tilemap row (the map is 32 cells wide) back from the probe cell, and stash that
  // cell — a later step reloads the pointer from here.
  const oneRowBack = (mem16[PROBE_CELL_PTR] - 32) & 0xffff;
  mem16[SAVED_CELL_PTR] = oneRowBack;

  const phase = mem8[SUBTILE_PHASE];

  // First lookup: is that neighbouring tile listed in table A's phase row? The row is picked
  // by (phase + 32), held to a single byte so the selector wraps within 0..255.
  const neighbourTile = mem8[oneRowBack];
  let matched = romRowHas(m, TABLE_A + ((phase + 32) & 0xff), neighbourTile);

  // A hit at phase 0 is final — there is no table-B row to consult at phase 0.
  if (matched && phase !== 0) {
    // Second lookup: the following tile, against table B's phase row (phase - 32).
    const followingTile = mem8[(oneRowBack + 1) & 0xffff];
    matched = romRowHas(m, TABLE_B + ((phase - 32) & 0xff), followingTile);
  }

  // Report the result: the zero flag for the still-oracle caller to branch on, and a return.
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
  return matched;
}

/** True if `tile` appears anywhere in the 32-entry ROM table row starting at `rowBase`. */
function romRowHas(m, rowBase, tile) {
  const { mem8 } = m;
  for (let i = 0; i < 32; i++) {
    if (mem8[rowBase + i] === tile) return true;
  }
  return false;
}
