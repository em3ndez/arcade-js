// SPDX-License-Identifier: GPL-3.0-only
import { seedTripleArrays } from "./seedTripleArrays.js";
import { rotateTripleArray } from "./rotateTripleArray.js";
import { resetVectorTailCursor } from "./resetVectorTailCursor.js";
import { emitVectorTailRecord } from "./emitVectorTailRecord.js";

// Computed dispatch: the caller passes Y as a byte offset into a 2-byte-per-entry table (0,2,4,6).
// Select the entry and tail-return the dispatched routine's result.
const TABLE = [seedTripleArrays, rotateTripleArray, resetVectorTailCursor, emitVectorTailRecord];

export function loc_b84e(m, y = m.regs.y) {
  return TABLE[y >> 1](m);
}
