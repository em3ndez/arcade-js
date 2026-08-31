// SPDX-License-Identifier: GPL-3.0-only
import { dispatchRopeCellState } from "./dispatchRopeCellState.js";
import { ROPE_EXTEND_INDEX, ROPE_CELL_STATE_BASE } from "./names.js";
/**
 * driveActiveRopeCells — drive every active rope cell through its per-cell handler.
 *
 * ROM 0x2e22-0x2e35. Grounding: [seen].
 *
 * WHAT IT IS
 *   Pooyan's playfield grows vertical ropes down the screen, and a grabbable object rides each
 *   one, carried down a notch at a time. The rope is built up segment by segment: a companion
 *   extend driver adds segments and, as it does, advances a segment index that doubles as the
 *   count of ropes now in play. Each of those ropes keeps a one-byte STATE cell in a small
 *   packed array. This routine is the per-pass driver for that array — it runs every active rope
 *   cell through its handler exactly once, so that on this pass each rope takes its next step
 *   (spawn an object, carry it down, test for a catch, or retract a spent segment).
 *
 * ITS ROLE IN THE MACHINE
 *   Two work-RAM cells define the sweep. ROPE_EXTEND_INDEX (0x8f18) holds how many rope cells are
 *   live — the same segment index the extend path grows — and ROPE_CELL_STATE_BASE (0x8f1c) is
 *   the base of the per-cell STATE array, one byte per cell laid out consecutively. This routine
 *   reads the count, then for cell 0, 1, 2, … up to that count it hands the address of that cell's
 *   STATE byte to dispatchRopeCellState. The dispatcher reads the cell's state and routes it to
 *   the one handler that owns that state, so the four-state life of every rope (seed → carry →
 *   carry-with-grab-check → retract) is stepped forward one notch per pass, per rope. When no
 *   ropes are live the count is zero and the sweep does nothing.
 *
 * LIVE-OUT: none — a void driver; it only sequences the per-cell handlers and returns. Every
 * effect lives in memory: the per-cell STATE records, the spawned/hung object records, and the
 * tile codes the handlers blit into the page-0x84 video RAM.
 */
export function driveActiveRopeCells(m) {
  // How many rope cells are live this frame. ROPE_EXTEND_INDEX (0x8f18) is the rope's segment
  // index — grown by the extend path as segments are added — and here it doubles as the active-cell
  // count. When it is zero no rope hangs, the loop body never runs, and the routine falls straight
  // through: nothing to drive.
  const count = m.mem8[ROPE_EXTEND_INDEX];
  // Walk the per-cell STATE array once, one iteration per live cell, cell 0 first. The cells are
  // packed one byte apart from ROPE_CELL_STATE_BASE (0x8f1c), so cell i's STATE byte lives at
  // ROPE_CELL_STATE_BASE + i.
  for (let i = 0; i < count; i++) {
    // Hand cell i's record (its STATE byte address, 0x8f1c + i) to the per-cell dispatcher. The
    // dispatcher reads that state and routes the cell to its handler — seed a hung object, carry it
    // down, carry it down while checking for a player catch, or retract a spent segment — so this
    // one call advances that rope by a single step this pass.
    dispatchRopeCellState(m, ROPE_CELL_STATE_BASE + i);
  }
}
