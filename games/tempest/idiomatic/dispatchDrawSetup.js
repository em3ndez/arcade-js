// SPDX-License-Identifier: GPL-3.0-only
import { seedTripleArrays } from "./seedTripleArrays.js";
import { rotateTripleArray } from "./rotateTripleArray.js";
import { resetVectorTailCursor } from "./resetVectorTailCursor.js";
import { emitVectorTailRecord } from "./emitVectorTailRecord.js";

/**
 * dispatchDrawSetup -- run one of four draw-setup phase routines chosen by Y. ROM 0xb84e.
 *
 * Role in the machine: the shape-1 enemy animation (animateShapeOneVector) advances a phase counter each
 * frame and, at the appropriate phases, has to prepare the vector-record scratch before emitting the
 * animation's coordinate pair. The four preparation steps -- seeding the triple arrays, rotating them,
 * resetting the vector-tail cursor, and emitting a vector-tail record -- are reached through this computed
 * jump so the animation can select the right one by phase.
 *
 * Behavior: the caller passes Y as a byte offset (0,2,4,6) into a 2-byte-per-entry table. The routine
 * selects TABLE[Y>>1] -- seedTripleArrays, rotateTripleArray, resetVectorTailCursor, or emitVectorTailRecord
 * -- and tail-returns that routine's result to this routine's own caller. The original's word-table
 * RTS trampoline is dissolved here into a direct table select.
 *
 * Live-out: whatever the selected setup routine writes into the triple arrays / vector-tail scratch.
 * Grounding: [seen].
 */
const TABLE = [seedTripleArrays, rotateTripleArray, resetVectorTailCursor, emitVectorTailRecord];

export function dispatchDrawSetup(m, y = m.regs.y) {
  return TABLE[y >> 1](m);
}
