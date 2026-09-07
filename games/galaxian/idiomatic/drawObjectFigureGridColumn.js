// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawObjectFigureGridColumn — repaint one column of the standing enemy formation, once per frame.
 *
 * WHAT IT IS
 *   The head of the object-figure grid draw walk. The enemy figures on screen are painted not all at
 *   once but one column per frame, as the idle-work step the display-list drain runs whenever its command
 *   queue has nothing pending. Which column is painted this frame is chosen by the frame counter's low
 *   nibble, so cycling that nibble 0..15 repaints the whole grid (plus the status column) every sixteen
 *   frames — spreading the redraw cost across frames instead of doing it in one burst.
 *
 * ROLE IN THE MACHINE
 *   Reads the LOW NIBBLE of FRAME_COUNTER (0x425f) as a column phase 0..15 — an index of which column to
 *   paint, not a count of figures. Two special cases and the main body:
 *     - phase 0: repaint the player-status column instead, via repaintPlayerStatusColumnFromModeGate
 *       (0x209c); this is why the status HUD refreshes as part of the same sixteen-frame cycle.
 *     - OBJECT_DRAW_SUPPRESS (0x4238) bit 0 set: the whole figure draw is gated off — this is armed while
 *       VRAM is being bulk-filled/reset so a half-cleared screen is not drawn over.
 *     - otherwise: form a pointer into the object grid OBJECT_GRID_BASE (0x4120) offset by the column and
 *       hand it to routeObjectGridCellDraw (0x207d) to walk that column's six rows at stride 0x10.
 *
 * ROM 0x2067.  Grounding: [seen].
 *
 * LIVE-OUT: whatever the tail call returns (a status column or one grid column repainted in VRAM).
 */
import { FRAME_COUNTER, OBJECT_DRAW_SUPPRESS, OBJECT_GRID_BASE } from "./names.js";
import { repaintPlayerStatusColumnFromModeGate } from "./repaintPlayerStatusColumnFromModeGate.js";
import { routeObjectGridCellDraw } from "./routeObjectGridCellDraw.js";

const ROW_STRIDE = 0x10; // grid row stride the per-cell loop advances the pointer by (C)
const ROW_COUNT = 6;     // rows per column the loop draws (B)

export function drawObjectFigureGridColumn(m) {
  const { mem8 } = m;

  // Low nibble of the free-running per-frame counter selects this frame's grid column (0..15).
  const column = mem8[FRAME_COUNTER] & 0x0f; // frame-phase column index (0..15)
  // Phase 0 is reserved for the player-status column, not a figure column.
  if (column === 0) return repaintPlayerStatusColumnFromModeGate(m); // phase 0: status column instead

  // grid base + column; the add stays in the low byte (column <= 15, base low byte 0x20) so it cannot carry.
  const ptr = OBJECT_GRID_BASE + column;

  // Suppression gate: skip the figure draw entirely while a bulk VRAM fill/reset is in progress.
  if (mem8[OBJECT_DRAW_SUPPRESS] & 0x01) return; // draw suppressed (during VRAM fill/reset)

  // Draw the column's six rows: seed the per-cell loop with the grid pointer, row stride, and row count.
  return routeObjectGridCellDraw(m, (ROW_COUNT << 8) | ROW_STRIDE, ptr); // BC = rows<<8|stride, HL = grid pointer
}
