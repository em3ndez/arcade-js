// SPDX-License-Identifier: GPL-3.0-only
import { TILEMAP_PTR_LO, loc_88, loc_d7, loc_ef } from "./names.js";

/**
 * maybeDecrementTableEntry — conditionally decrement one byte of the $d7 zero-page table.
 *
 * Role in the machine: the $d7 array holds a per-column (per-slot) tally used by the
 * playfield/mushroom bookkeeping — the same array `stampEmptyTileCell` bumps when a cell is
 * seeded. This routine walks in the other direction: given the current working column code, it
 * decides whether that column is "in band" and, if so, knocks its tally down by one. It is how
 * a column's count is retired as the field changes.
 *
 * The in-band test is orientation-aware. It forms v from the low five bits of the working tile
 * pointer's low byte ($32), then picks one of two bands off the flip mask $ef: with $ef == 0
 * (upright cabinet) a column counts when v is below 0x0c; otherwise (mirrored cabinet) a column
 * counts when v is at least 0x14. This is the same "which columns count flips with orientation"
 * hinge that runs through the whole tile subsystem, so one body of code serves both screen flips.
 *
 * Cells: $32 (TILEMAP_PTR_LO) the working tile pointer low byte; $ef the flip/orientation mask;
 * $88 the actor-slot index into the table; $d7 the base of the per-column tally array.
 *
 * Grounding: [code]. Live-out: at most one byte of the $d7 table (or no write at all).
 */
export function maybeDecrementTableEntry(m) {
  const { mem8 } = m;

  // Column code under consideration: the low five bits of the working tile pointer's low byte.
  const v = mem8[TILEMAP_PTR_LO] & 0x1f;

  // Select the band from the orientation mask. $ef == 0 is the upright cabinet (low band: the
  // column counts when it is below 0x0c); a nonzero $ef is the mirrored cabinet (high band: the
  // column counts when it is 0x14 or above). Only when the column falls in the active band do we
  // touch the tally at all.
  const bandLow = mem8[loc_ef] === 0; // loc_ef == 0 selects the low band (< 0x0c); else the high band (>= 0x14)
  const decrement = bandLow ? v < 0x0c : v >= 0x14;
  if (!decrement) return;

  // In band: decrement this slot's tally. The index comes from the actor-slot selector $88, and
  // the effective address is formed as zero-page,X — masked to 0xff so it wraps within page 0
  // exactly like the 6502 `dec $d7,x`. Storing through mem8 truncates to a byte, so decrementing
  // a stored 0x00 wraps it to 0xff, matching the hardware.
  const ea = (loc_d7 + mem8[loc_88]) & 0xff; // dec $d7,x — zero-page,X wraps in page 0
  mem8[ea] = mem8[ea] - 1;                    // store through mem8 truncates (dec of 0 wraps to 0xff)
}
