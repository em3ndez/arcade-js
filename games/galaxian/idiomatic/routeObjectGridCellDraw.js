// SPDX-License-Identifier: GPL-3.0-only
/**
 * routeObjectGridCellDraw — draw one cell (one row) of an object-figure grid column.
 *
 * WHAT IT IS
 *   The per-cell router inside the object-figure grid walk. Each enemy figure of the standing formation
 *   is painted a column at a time, six rows per column at a 16-byte stride; this routine handles exactly
 *   one of those rows. The grid pointer's low byte IS the packed draw coordinate for the cell (the Z80
 *   loads A from L), and bit 0 of the cell's own flag byte — the byte AT the grid pointer HL — selects
 *   which of two draw paths this row takes.
 *
 * ROLE IN THE MACHINE
 *   Called from drawObjectFigureGridColumn (ROM 0x2067), the display-list drain's idle-work step: once per
 *   frame, when the command queue is empty, it repaints one object-grid column and routes each of the six
 *   rows through here. Set flag bit → the cell is live and drawn as a timer-animated figure
 *   (drawAnimatedObjectGridCellAndAdvance); clear → it is stamped as a fixed tile figure
 *   (drawFixedTileFigureAtPackedCoord) and then falls into the shared loop tail. The sixteen frame-counter
 *   phases repaint the whole grid once every sixteen frames (mechanisms.md "The object-figure grid draw walk").
 *
 * ROM 0x207d.  Grounding: [seen].
 *
 * NO-PUSH: the Z80 form never pushes across the draw, so the row count/stride (BC) and grid pointer (HL)
 * are not stack-saved — they ride these JS locals, forwarded straight into the draw and the epilogue.
 * LIVE-OUT: memory/VRAM only; control tail-forwards into the animated draw or the loop epilogue, and this
 * routine returns whatever that forwarded call returns.
 */
import { drawFixedTileFigureAtPackedCoord } from "./drawFixedTileFigureAtPackedCoord.js";
import { drawAnimatedObjectGridCellAndAdvance } from "./drawAnimatedObjectGridCellAndAdvance.js";
import { objectGridWalkLoopEpilogue } from "./objectGridWalkLoopEpilogue.js";

export function routeObjectGridCellDraw(m, bc = m.regs.bc, hl = m.regs.hl) {
  const { mem8 } = m;
  const coord = hl & 0xff; // A = L: packed draw coordinate

  // Bit 0 of the cell's flag byte (the byte AT the grid pointer HL) chooses this row's draw path.
  if (mem8[hl] & 1) {
    // Active cell: hand the packed coordinate across via A (mirroring the Z80's A=L), then tail-forward
    // the saved loop state — grid pointer (HL) and row count/stride (BC) — into the animated-figure draw,
    // which also runs the shared loop tail so the column keeps walking to its next row.
    return (m.regs.a = coord, drawAnimatedObjectGridCellAndAdvance(m, hl, bc));
  }

  // Inactive cell: stamp the fixed tile figure at the packed coordinate. This draw clobbers the Z80
  // registers, so the saved loop state (HL, BC) survives only as the JS locals held here.
  drawFixedTileFigureAtPackedCoord(m, coord);
  // Run the shared loop epilogue over the remaining rows: it advances the grid pointer by the row stride
  // and loops back to this router while rows remain, else returns and ends the column.
  return objectGridWalkLoopEpilogue(m, hl, bc);
}
