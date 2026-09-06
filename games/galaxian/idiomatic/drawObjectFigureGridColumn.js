// SPDX-License-Identifier: GPL-3.0-only
// Object-figure draw head, run as the display-list drain's idle-work step. Read the frame counter's low
// nibble as a grid-column phase: phase 0 repaints the player-status column; otherwise, unless the draw-suppress
// gate is set, index the object grid by that column and draw its six rows (stride 0x10) via the per-cell router.
import { FRAME_COUNTER, OBJECT_DRAW_SUPPRESS, OBJECT_GRID_BASE } from "./names.js";
import { repaintPlayerStatusColumnFromModeGate } from "./repaintPlayerStatusColumnFromModeGate.js";
import { routeObjectGridCellDraw } from "./routeObjectGridCellDraw.js";

const ROW_STRIDE = 0x10; // grid row stride the per-cell loop advances the pointer by (C)
const ROW_COUNT = 6;     // rows per column the loop draws (B)

export function drawObjectFigureGridColumn(m) {
  const { mem8 } = m;

  const column = mem8[FRAME_COUNTER] & 0x0f; // frame-phase column index (0..15)
  if (column === 0) return repaintPlayerStatusColumnFromModeGate(m); // phase 0: status column instead

  // grid base + column; the add stays in the low byte (column <= 15, base low byte 0x20) so it cannot carry.
  const ptr = OBJECT_GRID_BASE + column;

  if (mem8[OBJECT_DRAW_SUPPRESS] & 0x01) return; // draw suppressed (during VRAM fill/reset)

  // Draw the column's six rows: seed the per-cell loop with the grid pointer, row stride, and row count.
  return routeObjectGridCellDraw(m, (ROW_COUNT << 8) | ROW_STRIDE, ptr); // BC = rows<<8|stride, HL = grid pointer
}
