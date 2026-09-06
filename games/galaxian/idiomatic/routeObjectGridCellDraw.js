// SPDX-License-Identifier: GPL-3.0-only
// One cell of the object-figure grid column (6 rows, stride 16). The grid pointer's low byte is the packed
// draw coordinate (A = L); bit 0 of the cell's flag byte (HL) selects the path -- set: the animated-figure
// draw + shared loop epilogue; clear: stamp the fixed tile figure at that coordinate, then the epilogue. The
// layer never pushes, so the row count/stride (BC) and grid pointer (HL) ride JS locals forwarded to the
// epilogue, which advances the pointer and loops back or returns once the six rows are done.
import { drawFixedTileFigureAtPackedCoord } from "./drawFixedTileFigureAtPackedCoord.js";
import { drawAnimatedObjectGridCellAndAdvance } from "./drawAnimatedObjectGridCellAndAdvance.js";
import { objectGridWalkLoopEpilogue } from "./objectGridWalkLoopEpilogue.js";

export function routeObjectGridCellDraw(m, bc = m.regs.bc, hl = m.regs.hl) {
  const { mem8 } = m;
  const coord = hl & 0xff; // A = L: packed draw coordinate

  if (mem8[hl] & 1) {
    // active cell: hand the coord across via A, forward the saved loop state to the draw + epilogue.
    return (m.regs.a = coord, drawAnimatedObjectGridCellAndAdvance(m, hl, bc));
  }

  drawFixedTileFigureAtPackedCoord(m, coord);
  // the draw clobbers the registers; the saved loop state rides JS locals to the shared epilogue.
  return objectGridWalkLoopEpilogue(m, hl, bc);
}
