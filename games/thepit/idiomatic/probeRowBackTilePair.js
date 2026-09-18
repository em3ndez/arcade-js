// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeRowBackTilePair — probe two phase-keyed tables for the tile one row back from the probe cell.
 *
 * One arm of the per-direction tile probe the movement dispatcher runs to decide whether an object
 * may travel a given way. It looks one tilemap row (the map is 32 cells wide) back from the probe
 * cell, stashes that cell at SAVED_CELL_PTR, and searches table A's phase row (chosen by
 * SUBTILE_PHASE) for the neighbouring tile: a miss reports "no match"; a hit at phase 0 reports
 * "match" at once; otherwise it searches table B's phase row for the following tile and reports
 * whether THAT matched. It writes only SAVED_CELL_PTR and leaves the answer in the zero flag (F_Z)
 * for the caller. The name stays neutral — this variant's table semantics are not grounded enough
 * to name without over-claiming.
 */
import { F_Z } from "../../../core/cpu/z80.js";
import { SUBTILE_PHASE, PROBE_CELL_PTR, SAVED_CELL_PTR } from "./names.js";
import { u16 } from "../../../core/int.js";

// Bases of the two phase-keyed probe tables' rows.
const TABLE_A = 0x34fe;
const TABLE_B = 0x35fe;

export function probeRowBackTilePair(m) {
  const { regs, mem8, mem16 } = m;

  // Look one tilemap row back from the probe cell, and stash it (a later step reloads the pointer).
  const oneRowBack = u16(mem16[PROBE_CELL_PTR] - 32);
  mem16[SAVED_CELL_PTR] = oneRowBack;

  const phase = mem8[SUBTILE_PHASE];

  // First lookup: is the neighbouring tile in table A's phase row (row = phase + 32, held to a byte)?
  const neighbourTile = mem8[oneRowBack];
  let matched = romRowHas(m, TABLE_A + ((phase + 32) & 0xff), neighbourTile);

  // A hit at phase 0 is final — there is no table-B row to consult at phase 0.
  if (matched && phase !== 0) {
    // Second lookup: the following tile, against table B's phase row (phase - 32).
    const followingTile = mem8[u16(oneRowBack + 1)];
    matched = romRowHas(m, TABLE_B + ((phase - 32) & 0xff), followingTile);
  }

  // Report the result: the zero flag for the caller to branch on, and a return.
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
  return matched;
}

/** True if `tile` appears anywhere in the 32-entry table row starting at `rowBase`. */
function romRowHas(m, rowBase, tile) {
  const { mem8 } = m;
  for (let i = 0; i < 32; i++) {
    if (mem8[rowBase + i] === tile) return true;
  }
  return false;
}
